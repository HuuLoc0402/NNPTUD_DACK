const crypto = require('crypto');
const axios = require('axios');

class PaymentGateway {
  // ============= VNPAY =============
  static getVNPayRequestHashMode() {
    const mode = String(process.env.VNPAY_HASH_MODE || 'raw').trim().toLowerCase();
    return mode === 'raw' ? 'raw' : 'encoded';
  }

  static normalizeVNPayParams(params = {}) {
    return Object.entries(params).reduce((acc, [key, value]) => {
      if (value === undefined || value === null || value === '') {
        return acc;
      }

      acc[key] = String(value);
      return acc;
    }, {});
  }

  static buildVNPayDateParts(date = new Date()) {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date).reduce((acc, part) => {
      if (part.type !== 'literal') {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});
  }

  static buildVNPayTimestamp(date = new Date()) {
    const parts = this.buildVNPayDateParts(date);
    return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
  }

  static buildVNPayHashData(params = {}, mode = 'encoded') {
    const normalizedParams = this.normalizeVNPayParams(params);

    return Object.keys(params)
      .sort()
      .map((key) => {
        if (mode === 'raw') {
          return `${key}=${normalizedParams[key]}`;
        }

        const queryParams = new URLSearchParams([[key, normalizedParams[key]]]);
        return queryParams.toString();
      })
      .join('&');
  }

  static buildVNPayQueryString(params = {}) {
    const normalizedParams = this.normalizeVNPayParams(params);
    const queryParams = new URLSearchParams();

    Object.keys(normalizedParams)
      .sort()
      .forEach((key) => {
        queryParams.append(key, normalizedParams[key]);
      });

    return queryParams.toString();
  }

  static getVNPayBaseUrl() {
    const configuredUrl = String(process.env.VNPAY_URL || '').trim().replace(/\/+$/, '');
    if (!configuredUrl) {
      return '';
    }

    if (configuredUrl.includes('/paymentv2/')) {
      return configuredUrl;
    }

    try {
      const parsedUrl = new URL(configuredUrl);
      return `${parsedUrl.origin}/paymentv2/vpcpay.html`;
    } catch (error) {
      return configuredUrl.replace(/\/paygate$/i, '') + '/paymentv2/vpcpay.html';
    }
  }

  static generateVNPayRequestData(orderData) {
    const tmnCode = String(process.env.VNPAY_TMNCODE || '').trim();
    const secretKey = String(process.env.VNPAY_HASHSECRET || '').trim();
    const vnpayUrl = this.getVNPayBaseUrl();
    const configuredReturnUrl = String(process.env.VNPAY_RETURN_URL || '').trim();
    const returnUrl = orderData.returnUrl || configuredReturnUrl || `${process.env.CLIENT_URL}/payment-callback`;

    const createDate = this.buildVNPayTimestamp(new Date());
    const expireDate = this.buildVNPayTimestamp(new Date(Date.now() + 15 * 60 * 1000));

    const params = this.normalizeVNPayParams({
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: orderData.transactionRef,
      vnp_OrderInfo: orderData.orderInfo || `Payment for order ${orderData.orderCode}`,
      vnp_OrderType: 'other',
      vnp_Amount: Math.round(Number(orderData.totalAmount || 0) * 100),
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: orderData.ipAddress || '127.0.0.1',
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate
    });

    if (!tmnCode || !secretKey || !vnpayUrl || !params.vnp_ReturnUrl) {
      throw new Error('VNPay configuration is incomplete');
    }

    const hashMode = this.getVNPayRequestHashMode();
    const signData = this.buildVNPayHashData(params, hashMode);
    const queryString = this.buildVNPayQueryString(params);
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    return {
      vnpayUrl,
      returnUrl,
      hashMode,
      params,
      queryString,
      signData,
      secureHash: signed,
      paymentUrl: `${vnpayUrl}?${queryString}&vnp_SecureHash=${signed}`
    };
  }

  static generateVNPayURL(orderData) {
    return this.generateVNPayRequestData(orderData).paymentUrl;
  }

  static extractVNPayParams(source = {}) {
    return Object.keys(source).reduce((acc, key) => {
      if (key.startsWith('vnp_')) {
        acc[key] = source[key];
      }
      return acc;
    }, {});
  }

  static verifyVNPayResponse(vnp_Params) {
    const secretKey = String(process.env.VNPAY_HASHSECRET || '').trim();
    const params = { ...vnp_Params };
    const secureHash = params['vnp_SecureHash'];

    delete params['vnp_SecureHash'];
    delete params['vnp_SecureHashType'];

    const signData = this.buildVNPayHashData(params, 'encoded');
    const hmac = crypto.createHmac('sha512', secretKey);
    const computed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    return computed === secureHash;
  }

  static getVNPayResponseMessage(responseCode) {
    const code = String(responseCode || '');
    const map = {
      '00': 'Thanh toán thành công.',
      '07': 'Giao dịch bị nghi ngờ gian lận.',
      '09': 'Thẻ hoặc tài khoản chưa đăng ký Internet Banking.',
      '10': 'Xác thực thông tin thẻ hoặc tài khoản không đúng quá 3 lần.',
      '11': 'Giao dịch đã hết hạn chờ thanh toán.',
      '12': 'Thẻ hoặc tài khoản đã bị khóa.',
      '13': 'Bạn nhập sai mật khẩu xác thực giao dịch.',
      '24': 'Bạn đã hủy giao dịch.',
      '51': 'Tài khoản không đủ số dư để thanh toán.',
      '65': 'Tài khoản đã vượt quá hạn mức giao dịch trong ngày.',
      '75': 'Ngân hàng thanh toán đang bảo trì.',
      '79': 'Bạn nhập sai mật khẩu thanh toán quá số lần quy định.'
    };

    return map[code] || 'Thanh toán không thành công.';
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
