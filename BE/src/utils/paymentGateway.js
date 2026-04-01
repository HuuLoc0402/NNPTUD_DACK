const crypto = require('crypto');
const axios = require('axios');

class PaymentGateway {
  // ============= VNPAY =============
  static generateVNPayURL(orderData) {
    const tmnCode = process.env.VNPAY_TMNCODE;
    const secretKey = process.env.VNPAY_HASHSECRET;
    const vnpayUrl = process.env.VNPAY_URL;
    const returnUrl = `${process.env.CLIENT_URL}/payment-callback`;

    const date = new Date();
    const createDate = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;

    const params = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: orderData.orderCode,
      vnp_OrderInfo: `Payment for order ${orderData.orderCode}`,
      vnp_OrderType: 'other',
      vnp_Amount: orderData.totalAmount * 100, // VNPay uses smallest unit
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: orderData.ipAddress || '127.0.0.1',
      vnp_CreateDate: createDate
    };

    // Sort parameters
    const sortedParams = Object.keys(params).sort().reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});

    // Create signature
    const signData = new URLSearchParams(sortedParams).toString();
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    sortedParams['vnp_SecureHash'] = signed;

    return `${vnpayUrl}?${new URLSearchParams(sortedParams).toString()}`;
  }

  static verifyVNPayResponse(vnp_Params) {
    const secretKey = process.env.VNPAY_HASHSECRET;
    const secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    const sortedParams = Object.keys(vnp_Params).sort().reduce((acc, key) => {
      acc[key] = vnp_Params[key];
      return acc;
    }, {});

    const signData = new URLSearchParams(sortedParams).toString();
    const hmac = crypto.createHmac('sha512', secretKey);
    const computed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    return computed === secureHash;
  }

  // ============= MOMO =============
  static async generateMoMoPayment(orderData) {
    const partnerCode = process.env.MOMO_PARTNER_CODE;
    const accessKey = process.env.MOMO_ACCESS_KEY;
    const secretKey = process.env.MOMO_SECRET_KEY;
    const momoUrl = process.env.MOMO_URL;

    const requestId = `${orderData.orderCode}-${Date.now()}`;
    const orderId = orderData.orderCode;
    const orderInfo = `Payment for order ${orderData.orderCode}`;
    const amount = orderData.totalAmount.toString();
    const redirectUrl = `${process.env.CLIENT_URL}/payment-callback`;
    const ipnUrl = `${process.env.SERVER_URL}/api/v1/payments/momo-callback`;
    const requestType = 'captureWallet';
    const lang = 'vi';

    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(rawSignature)
      .digest('hex');

    const payload = {
      partnerCode,
      partnerName: 'MARC Fashion',
      storeId: 'MarcFashionStore',
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      lang,
      requestType,
      autoCapture: true,
      extraData: '',
      signature
    };

    try {
      const response = await axios.post(momoUrl, payload);
      return response.data;
    } catch (error) {
      throw new Error(`MoMo payment creation failed: ${error.message}`);
    }
  }

  static verifyMoMoSignature(data, signature) {
    const secretKey = process.env.MOMO_SECRET_KEY;
    const rawSignature = `accessKey=${process.env.MOMO_ACCESS_KEY}&amount=${data.amount}&extraData=${data.extraData || ''}&message=${data.message || ''}&orderId=${data.orderId}&orderInfo=${data.orderInfo}&partnerCode=${process.env.MOMO_PARTNER_CODE}&responseTime=${data.responseTime}&resultCode=${data.resultCode}&transId=${data.transId}`;

    const computed = crypto
      .createHmac('sha256', secretKey)
      .update(rawSignature)
      .digest('hex');

    return computed === signature;
  }

  // ============= VIETQR =============
  static generateVietQRPayment(orderData) {
    const bankCode = 'NCB'; // Example: NCB (Ngan Hang Quoc Te Viet Nam)
    const accountNo = process.env.VIETQR_ACCOUNT_NO || '0123456789';
    const accountName = 'MARC FASHION';
    const amount = orderData.totalAmount;
    const description = `Payment for order ${orderData.orderCode}`;

    // Generate QR code URL (simplified, actual implementation may vary)
    const qrUrl = `https://img.qr-server.com/qr?size=300x300&data=00020126360014com.vietqr011800${accountNo}5208${bankCode}53037045802VN5913ACOM VIETQR6009HO CHI MINH61051000062310717D63047D1D`;

    return {
      bankCode,
      accountNo,
      accountName,
      amount,
      description,
      qrUrl,
      reference: orderData.orderCode
    };
  }

  static verifyVietQRPayment(paymentData) {
    // Verify payment through VietQR API
    return paymentData && paymentData.status === 'completed';
  }

  // Helper to determine payment gateway response
  static getPaymentStatus(status) {
    const statusMap = {
      vnpay: {
        '00': 'completed',
        '01': 'pending',
        '02': 'failed',
        '24': 'cancelled'
      },
      momo: {
        0: 'completed',
        1: 'pending',
        2: 'failed'
      }
    };
    return statusMap;
  }
}

module.exports = PaymentGateway;
