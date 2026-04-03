const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Product = require('../models/Product');
const User = require('../models/User');

exports.countUsers = (filter = {}) => User.countDocuments(filter);
exports.countProducts = (filter = {}) => Product.countDocuments(filter);
exports.countOrders = (filter = {}) => Order.countDocuments(filter);

exports.sumRevenue = async () => {
  const result = await Order.aggregate([
    { $match: { orderStatus: { $ne: 'cancelled' } } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);

  return result[0]?.total || 0;
};

exports.getMonthlyRevenue = (startDate, endDate) => {
  return Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        orderStatus: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: { $month: '$createdAt' },
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

exports.getYearlyRevenue = (startDate, endDate) => {
  return Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        orderStatus: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: { $year: '$createdAt' },
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

exports.getOrderStatusDistribution = () => {
  return Order.aggregate([
    { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
};

exports.getPaymentMethodDistribution = () => {
  return Payment.aggregate([
    { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    { $sort: { count: -1 } }
  ]);
};

exports.getTopProducts = (limit) => {
  return Product.find({ isActive: true })
    .sort({ views: -1, commentCount: -1, ratingAverage: -1 })
    .limit(limit)
    .populate('category', 'name slug');
};