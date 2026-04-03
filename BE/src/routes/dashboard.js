const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const productController = require('../controllers/productController');
const { authenticate, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, adminOnly);

router.get('/stats', async (req, res, next) => {
  try {
    const [revenue, orders, customers, products] = await Promise.all([
      dashboardController.sumRevenue(),
      dashboardController.countOrders(),
      dashboardController.countUsers({ role: 'user' }),
      dashboardController.countProducts({ isActive: true })
    ]);

    return res.status(200).json({
      success: true,
      data: { revenue, orders, customers, products }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/revenue/monthly', async (req, res, next) => {
  try {
    const year = Number(req.query.year || new Date().getFullYear());
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    const data = await dashboardController.getMonthlyRevenue(startDate, endDate);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/revenue/yearly', async (req, res, next) => {
  try {
    const startYear = Number(req.query.startYear || new Date().getFullYear() - 4);
    const endYear = Number(req.query.endYear || new Date().getFullYear());
    const startDate = new Date(startYear, 0, 1);
    const endDate = new Date(endYear, 11, 31, 23, 59, 59, 999);
    const data = await dashboardController.getYearlyRevenue(startDate, endDate);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/products/top-selling', async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 10);
    const products = await dashboardController.getTopProducts(limit);
    return res.status(200).json({
      success: true,
      data: products.map((product) => productController.formatProduct(product, false))
    });
  } catch (error) {
    next(error);
  }
});

router.get('/orders/status-distribution', async (req, res, next) => {
  try {
    const data = await dashboardController.getOrderStatusDistribution();
    return res.status(200).json({
      success: true,
      data: data.map((item) => ({ status: item._id === 'shipping' ? 'shipped' : item._id, count: item.count }))
    });
  } catch (error) {
    next(error);
  }
});

router.get('/payments/method-distribution', async (req, res, next) => {
  try {
    const data = await dashboardController.getPaymentMethodDistribution();
    return res.status(200).json({
      success: true,
      data: data.map((item) => ({ method: item._id, count: item.count, total: item.total }))
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;