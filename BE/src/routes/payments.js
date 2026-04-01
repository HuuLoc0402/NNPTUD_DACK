const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');

// Payment processing
router.post('/vnpay/process', authenticate, paymentController.processVNPayPayment);
router.get('/vnpay/callback', paymentController.handleVNPayCallback);

router.post('/momo/process', authenticate, paymentController.processMoMoPayment);
router.post('/momo/callback', paymentController.handleMoMoCallback);

router.post('/vietqr/process', authenticate, paymentController.processVietQRPayment);

// Payment status
router.get('/status/:orderId', authenticate, paymentController.getPaymentStatus);
router.get('/order/:orderId', authenticate, paymentController.getOrderPayments);

// Admin routes
router.get('/admin/all', authenticate, authorize('admin'), paymentController.getAllPayments);

module.exports = router;
