const express = require('express');
const PaymentGateway = require('../utils/paymentGateway');
const orderController = require('../controllers/orderController');
const paymentController = require('../controllers/paymentController');
const cartController = require('../controllers/cartController');
const { authenticate } = require('../middleware/auth');
const { applyInventoryForOrder } = require('../utils/orderInventory');
const { sendInvoiceEmailForCompletedOrder } = require('../utils/invoiceMailer');

const router = express.Router();

const isVNPayConfigured = () => {
  return Boolean(
    String(process.env.VNPAY_URL || '').trim()
    && String(process.env.VNPAY_TMNCODE || '').trim()
    && String(process.env.VNPAY_HASHSECRET || '').trim()
  );
};

const isVNPayMockModeEnabled = () => {
  return String(process.env.VNPAY_MOCK_MODE || '').trim().toLowerCase() === 'true';
};

const canAccessOrder = (order, req) => {
  return req.userRole === 'admin' || String(order.user?._id || order.user) === String(req.userId);
};

const getServerOrigin = (req) => {
  const configuredServerUrl = String(process.env.SERVER_URL || '').trim().replace(/\/$/, '');
  if (isHttpUrl(configuredServerUrl)) {
    return configuredServerUrl;
  }

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'http';
  const rawHost = String(req.get('host') || '').trim();
  const normalizedHost = rawHost.replace(/^localhost(?=:\d+$|$)/i, '127.0.0.1');
  return `${protocol}://${normalizedHost}`;
};

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

const getClientBaseUrl = (req, providedUrl = '') => {
  if (isHttpUrl(providedUrl)) {
    return String(providedUrl).trim().replace(/\/$/, '');
  }

  const origin = String(req.headers.origin || '').trim();
  if (isHttpUrl(origin)) {
    return origin.replace(/\/$/, '');
  }

  const clientUrl = String(process.env.CLIENT_URL || 'http://localhost:5500').trim().replace(/\/$/, '');
  if (clientUrl.endsWith('.html')) {
    try {
      return new URL(clientUrl).origin;
    } catch (error) {
      return 'http://localhost:5500';
    }
  }

  return clientUrl;
};

const getClientPageUrl = (baseUrl, pageName) => {
  return `${String(baseUrl || 'http://localhost:5500').replace(/\/$/, '')}/FE/pages/customer/${pageName}.html`;
};

const getPaymentResultPageUrl = (baseUrl, paymentStatus) => {
  return getClientPageUrl(baseUrl, paymentStatus === 'completed' ? 'payment-success' : 'payment-failed');
};

const getStoredClientBaseUrl = (payment) => {
  const storedBaseUrl = payment?.paymentGatewayResponse?.clientBaseUrl;
  return isHttpUrl(storedBaseUrl) ? String(storedBaseUrl).trim().replace(/\/$/, '') : '';
};

const getConfiguredVNPayReturnUrl = () => {
  const configuredUrl = String(process.env.VNPAY_RETURN_URL || '').trim();
  return isHttpUrl(configuredUrl) ? configuredUrl.replace(/\/$/, '') : '';
};

const buildFrontendResultUrl = (baseUrl, params = {}) => {
  const url = new URL(baseUrl);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
};

const buildVNPayReturnUrl = (req) => {
  const configuredReturnUrl = getConfiguredVNPayReturnUrl();
  if (configuredReturnUrl) {
    return configuredReturnUrl;
  }

  return new URL('/api/v1/payments/vnpay-return', getServerOrigin(req)).toString();
};

const buildPaymentPageState = ({ baseUrl, order, payment, paymentStatus, paymentMethod, message }) => {
  return buildFrontendResultUrl(getPaymentResultPageUrl(baseUrl, paymentStatus), {
    orderId: order?._id,
    paymentId: payment?._id,
    paymentStatus,
    paymentMethod,
    message
  });
};

const buildMockVNPayUrl = (req, payment) => {
  const callbackUrl = new URL(buildVNPayReturnUrl(req));
  callbackUrl.searchParams.set('vnp_TxnRef', payment.transactionId);
  callbackUrl.searchParams.set('vnp_ResponseCode', '00');
  callbackUrl.searchParams.set('vnp_TransactionStatus', '00');
  callbackUrl.searchParams.set('vnp_BankCode', 'NCB');
  callbackUrl.searchParams.set('vnp_PayDate', new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14));
  callbackUrl.searchParams.set('mock', 'true');
  return callbackUrl.toString();
};

const buildMockGatewayResultUrl = (req, orderId, method, clientReturnUrl = '') => {
  return buildFrontendResultUrl(getPaymentResultPageUrl(getClientBaseUrl(req, clientReturnUrl), 'completed'), {
    orderId,
    paymentMethod: method,
    paymentStatus: 'completed',
    message: `Đã mô phỏng thanh toán ${String(method || '').toUpperCase()} thành công.`
  });
};

const getPaymentResultMeta = (responseCode, transactionStatus) => {
  const normalizedCode = String(responseCode || transactionStatus || '99');

  if (normalizedCode === '00') {
    return {
      status: 'completed',
      paymentStatus: 'completed',
      message: 'Thanh toán VNPay thành công.'
    };
  }

  if (normalizedCode === '24') {
    return {
      status: 'cancelled',
      paymentStatus: 'cancelled',
      message: 'Bạn đã hủy giao dịch thanh toán VNPay.'
    };
  }

  return {
    status: 'failed',
    paymentStatus: 'failed',
    message: PaymentGateway.getVNPayResponseMessage(normalizedCode)
  };
};

const resolveClientIp = (req) => {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const rawIp = forwarded || req.ip || req.connection?.remoteAddress || '127.0.0.1';
  const normalizedIp = rawIp.replace('::ffff:', '').trim();

  if (!normalizedIp || normalizedIp === '::1' || normalizedIp.toLowerCase() === 'localhost') {
    return '127.0.0.1';
  }

  if (normalizedIp.includes(':') && !normalizedIp.includes('.')) {
    return '127.0.0.1';
  }

  return normalizedIp;
};

const finalizeVNPayPayment = async ({ payment, order, vnpParams, resultMeta }) => {
  if (!payment || !order) {
    return null;
  }

  if (resultMeta.paymentStatus === 'completed' && !order.inventoryAdjustedAt) {
    await applyInventoryForOrder(order);
    try {
      await cartController.clearCart(order.user?._id || order.user);
    } catch (error) {
      console.error('Clear cart after VNPay success error:', error.message);
    }
  }

  if (payment.status !== 'completed') {
    await paymentController.updatePayment(payment._id, {
      status: resultMeta.status,
      responseCode: String(vnpParams.vnp_ResponseCode || ''),
      responseMessage: resultMeta.message,
      paymentGatewayResponse: {
        ...(payment.paymentGatewayResponse || {}),
        vnpParams
      },
      completedAt: resultMeta.status === 'completed' ? new Date() : undefined,
      failureReason: resultMeta.status === 'completed' ? '' : resultMeta.message
    });
  }

  if (resultMeta.paymentStatus === 'completed') {
    const updatedOrder = await orderController.updateOrder(order._id, {
      paymentStatus: 'completed',
      transactionId: payment.transactionId
    });
    const invoiceResult = await sendInvoiceEmailForCompletedOrder({ order: updatedOrder, payment });
    if (!invoiceResult.success && !invoiceResult.skipped) {
      console.error('Send invoice email after VNPay success error:', invoiceResult.error || invoiceResult.reason);
    }
    return null;
  }

  if (order.paymentStatus !== 'completed') {
    await orderController.updateOrder(order._id, {
      paymentStatus: resultMeta.paymentStatus,
      transactionId: payment.transactionId
    });
  }

  return null;
};

const createPendingPayment = async (req, order, method, extra = {}) => {
  return paymentController.createPayment({
    order: order._id,
    user: req.userId,
    amount: order.totalAmount,
    paymentMethod: method,
    transactionId: `${method.toUpperCase()}${Date.now()}${Math.floor(Math.random() * 10000)}`,
    status: 'pending',
    description: `Payment for order ${order.orderCode}`,
    paymentGatewayResponse: extra.paymentGatewayResponse || {},
    ipAddress: resolveClientIp(req),
    userAgent: req.headers['user-agent'] || ''
  });
};

router.post('/vnpay', authenticate, async (req, res, next) => {
  try {
    const useVNPayMock = isVNPayMockModeEnabled();
    const hasVNPayConfig = isVNPayConfigured();

    if (!hasVNPayConfig && !useVNPayMock) {
      return res.status(503).json({
        success: false,
        message: 'Cấu hình VNPay chưa đầy đủ. Vui lòng kiểm tra lại cấu hình thanh toán.'
      });
    }

    const order = await orderController.findOrderById(req.body.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!canAccessOrder(order, req)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thanh toán đơn hàng này' });
    }

    if (order.paymentStatus === 'completed') {
      return res.status(400).json({ success: false, message: 'Đơn hàng này đã được thanh toán trước đó' });
    }

    const clientBaseUrl = getClientBaseUrl(req, req.body.clientBaseUrl || req.body.clientReturnUrl);
    const payment = await createPendingPayment(req, order, 'vnpay', {
      paymentGatewayResponse: {
        clientBaseUrl
      }
    });
    let paymentUrl = '';

    if (hasVNPayConfig) {
      const requestData = PaymentGateway.generateVNPayRequestData({
        transactionRef: payment.transactionId,
        orderCode: order.orderCode,
        totalAmount: order.totalAmount,
        orderInfo: `Thanh toan don hang ${order.orderCode}`,
        ipAddress: resolveClientIp(req),
        returnUrl: buildVNPayReturnUrl(req)
      });

      paymentUrl = requestData.paymentUrl;
      await paymentController.updatePayment(payment._id, {
        paymentGatewayResponse: {
          ...(payment.paymentGatewayResponse || {}),
          clientBaseUrl,
          requestDebug: {
            hashMode: requestData.hashMode,
            params: requestData.params,
            queryString: requestData.queryString,
            signData: requestData.signData,
            secureHash: requestData.secureHash,
            returnUrl: requestData.returnUrl,
            paymentUrl: requestData.paymentUrl
          }
        }
      });
    } else if (useVNPayMock) {
      paymentUrl = buildMockVNPayUrl(req, payment);
    }

    return res.status(200).json({
      success: true,
      data: {
        paymentId: payment._id,
        paymentUrl
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/vnpay-return', async (req, res, next) => {
  try {
    const vnpParams = PaymentGateway.extractVNPayParams(req.query);
    const transactionRef = String(vnpParams.vnp_TxnRef || '').trim();

    if (!transactionRef) {
      return res.redirect(buildPaymentPageState({
        baseUrl: getClientBaseUrl(req),
        order: null,
        payment: null,
        paymentStatus: 'failed',
        paymentMethod: 'vnpay',
        message: 'Thiếu mã giao dịch VNPay.'
      }));
    }

    const payment = await paymentController.findPaymentByTransactionId(transactionRef);
    const clientBaseUrl = getStoredClientBaseUrl(payment) || getClientBaseUrl(req);
    if (!payment) {
      return res.redirect(buildPaymentPageState({
        baseUrl: clientBaseUrl,
        order: null,
        payment: null,
        paymentStatus: 'failed',
        paymentMethod: 'vnpay',
        message: 'Không tìm thấy giao dịch thanh toán tương ứng.'
      }));
    }

    const order = await orderController.findOrderById(payment.order?._id || payment.order);
    if (!order) {
      return res.redirect(buildPaymentPageState({
        baseUrl: clientBaseUrl,
        order: null,
        payment,
        paymentStatus: 'failed',
        paymentMethod: 'vnpay',
        message: 'Không tìm thấy đơn hàng tương ứng với giao dịch này.'
      }));
    }

    const isMock = isVNPayMockModeEnabled() && String(req.query.mock || '') === 'true';
    const isValidSignature = isMock ? true : PaymentGateway.verifyVNPayResponse(vnpParams);
    if (!isValidSignature) {
      return res.redirect(buildPaymentPageState({
        baseUrl: clientBaseUrl,
        order,
        payment,
        paymentStatus: 'failed',
        paymentMethod: 'vnpay',
        message: 'Chữ ký phản hồi VNPay không hợp lệ.'
      }));
    }

    const resultMeta = payment.status === 'completed' || order.paymentStatus === 'completed'
      ? {
          status: 'completed',
          paymentStatus: 'completed',
          message: 'Thanh toán VNPay đã được xác nhận trước đó.'
        }
      : getPaymentResultMeta(vnpParams.vnp_ResponseCode, vnpParams.vnp_TransactionStatus);

    await finalizeVNPayPayment({ payment, order, vnpParams, resultMeta });

    return res.redirect(buildPaymentPageState({
      baseUrl: clientBaseUrl,
      order,
      payment,
      paymentStatus: resultMeta.paymentStatus,
      paymentMethod: 'vnpay',
      message: resultMeta.message
    }));
  } catch (error) {
    next(error);
  }
});

router.post('/momo', authenticate, async (req, res, next) => {
  try {
    const order = await orderController.findOrderById(req.body.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!canAccessOrder(order, req)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thanh toán đơn hàng này' });
    }

    const payment = await createPendingPayment(req, order, 'momo');
    let payUrl = buildMockGatewayResultUrl(req, order._id, 'momo', req.body.clientReturnUrl);

    if (process.env.MOMO_URL && process.env.MOMO_PARTNER_CODE && process.env.MOMO_ACCESS_KEY && process.env.MOMO_SECRET_KEY) {
      const gatewayResponse = await PaymentGateway.generateMoMoPayment({
        orderCode: order.orderCode,
        totalAmount: order.totalAmount
      });
      payUrl = gatewayResponse.payUrl || gatewayResponse.deeplink || payUrl;
    }

    return res.status(200).json({
      success: true,
      data: {
        paymentId: payment._id,
        payUrl
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/vietqr', authenticate, async (req, res, next) => {
  try {
    const order = await orderController.findOrderById(req.body.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!canAccessOrder(order, req)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thanh toán đơn hàng này' });
    }

    const payment = await createPendingPayment(req, order, 'vietqr');
    const qrData = PaymentGateway.generateVietQRPayment({
      orderCode: order.orderCode,
      totalAmount: order.totalAmount
    });

    return res.status(200).json({
      success: true,
      data: {
        paymentId: payment._id,
        ...qrData
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:paymentId/status', authenticate, async (req, res, next) => {
  try {
    const payment = await paymentController.findPaymentById(req.params.paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    if (req.userRole !== 'admin' && String(payment.user?._id || payment.user) !== String(req.userId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem giao dịch này' });
    }

    return res.status(200).json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
