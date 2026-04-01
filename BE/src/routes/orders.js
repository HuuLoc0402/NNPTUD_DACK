const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, authorize } = require('../middleware/auth');

// Customer routes
router.post('/', authenticate, orderController.createOrder);
router.get('/', authenticate, orderController.getOrders);
router.get('/:id', authenticate, orderController.getOrder);
router.put('/:id/cancel', authenticate, orderController.cancelOrder);

// Admin routes
router.get('/admin/all', authenticate, authorize('admin'), orderController.getAllOrders);
router.put('/:id/status', authenticate, authorize('admin'), orderController.updateOrderStatus);

module.exports = router;
