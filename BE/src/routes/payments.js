const express = require('express');
const PaymentGateway = require('../utils/paymentGateway');
const orderController = require('../controllers/orderController');
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const canAccessOrder = (order, req) => {
  return req.userRole === 'admin' || String(order.user?._id || order.user) === String(req.userId);
};

const buildMockPaymentUrl = (orderId, method) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5500';
  return `${clientUrl}/FE/pages/customer/order-history.html?orderId=${orderId}&payment=${method}`;
};

const createPendingPayment = async (req, order, method) => {
  return paymentController.createPayment({
    order: order._id,
    user: req.userId,
    amount: order.totalAmount,
    paymentMethod: method,
    transactionId: `${method.toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    status: 'pending',
    description: `Payment for order ${order.orderCode}`,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || ''
  });
};

router.post('/vnpay', authenticate, async (req, res, next) => {
  try {
    const order = await orderController.findOrderById(req.body.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!canAccessOrder(order, req)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thanh toán đơn hàng này' });
    }

    const payment = await createPendingPayment(req, order, 'vnpay');
    const paymentUrl = process.env.VNPAY_URL && process.env.VNPAY_TMNCODE && process.env.VNPAY_HASHSECRET
      ? PaymentGateway.generateVNPayURL({
          orderCode: order.orderCode,
          totalAmount: order.totalAmount,
          ipAddress: req.ip
        })
      : buildMockPaymentUrl(order._id, 'vnpay');

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
    let payUrl = buildMockPaymentUrl(order._id, 'momo');

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