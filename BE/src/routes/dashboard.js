const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');

// Admin only routes
router.get('/stats', authenticate, authorize('admin'), dashboardController.getDashboardStats);
router.get('/revenue/monthly', authenticate, authorize('admin'), dashboardController.getRevenueByMonth);
router.get('/revenue/yearly', authenticate, authorize('admin'), dashboardController.getRevenueByYear);

router.get('/products/top-selling', authenticate, authorize('admin'), dashboardController.getTopSellingProducts);
router.get('/products/top-rated', authenticate, authorize('admin'), dashboardController.getTopRatedProducts);

router.get('/orders/status-distribution', authenticate, authorize('admin'), dashboardController.getOrderStatusDistribution);
router.get('/payments/method-distribution', authenticate, authorize('admin'), dashboardController.getPaymentMethodDistribution);

router.get('/users/stats', authenticate, authorize('admin'), dashboardController.getUserStats);
router.get('/products/stats', authenticate, authorize('admin'), dashboardController.getProductStats);

module.exports = router;
