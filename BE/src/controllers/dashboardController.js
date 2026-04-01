const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Product = require('../models/Product');
const User = require('../models/User');
const Comment = require('../models/Comment');

exports.getDashboardStats = async (req, res, next) => {
  try {
    // Total orders
    const totalOrders = await Order.countDocuments();
    const completedOrders = await Order.countDocuments({ paymentStatus: 'completed' });
    const pendingOrders = await Order.countDocuments({ orderStatus: 'pending' });

    // Total revenue
    const revenueData = await Order.aggregate([
      { $match: { paymentStatus: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenue = revenueData[0]?.total || 0;

    // Total products
    const totalProducts = await Product.countDocuments({ isActive: true });

    // Total users
    const totalUsers = await User.countDocuments({ isActive: true });

    // Average order value
    const avgOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;

    res.status(200).json({
      success: true,
      stats: {
        totalOrders,
        completedOrders,
        pendingOrders,
        totalRevenue,
        totalProducts,
        totalUsers,
        avgOrderValue
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getRevenueByMonth = async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const monthlyRevenue = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'completed',
          createdAt: {
            $gte: new Date(`${year}-01-01`),
            $lt: new Date(`${year + 1}-01-01`)
          }
        }
      },
      {
        $group: {
          _id: {
            $month: '$createdAt'
          },
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Create array with 12 months
    const data = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: new Date(2024, i).toLocaleString('en', { month: 'long' }),
      revenue: 0,
      orders: 0
    }));

    monthlyRevenue.forEach(item => {
      data[item._id - 1].revenue = item.total;
      data[item._id - 1].orders = item.count;
    });

    res.status(200).json({
      success: true,
      year,
      data
    });
  } catch (error) {
    next(error);
  }
};

exports.getRevenueByYear = async (req, res, next) => {
  try {
    const startYear = parseInt(req.query.startYear) || new Date().getFullYear() - 5;
    const endYear = parseInt(req.query.endYear) || new Date().getFullYear();

    const yearlyRevenue = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'completed',
          createdAt: {
            $gte: new Date(`${startYear}-01-01`),
            $lt: new Date(`${endYear + 1}-01-01`)
          }
        }
      },
      {
        $group: {
          _id: {
            $year: '$createdAt'
          },
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Create array for years
    const data = [];
    for (let year = startYear; year <= endYear; year++) {
      const yearData = yearlyRevenue.find(y => y._id === year);
      data.push({
        year,
        revenue: yearData?.total || 0,
        orders: yearData?.count || 0
      });
    }

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

exports.getTopSellingProducts = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const topProducts = await Order.aggregate([
      {
        $match: { paymentStatus: 'completed' }
      },
      {
        $unwind: '$items'
      },
      {
        $group: {
          _id: '$items.product',
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' }
        }
      },
      {
        $sort: { totalSold: -1 }
      },
      {
        $limit: limit
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $unwind: '$product'
      },
      {
        $project: {
          _id: 0,
          product: {
            _id: '$product._id',
            name: '$product.name',
            image: '$product.image',
            price: '$product.price'
          },
          totalSold: 1,
          totalRevenue: 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: topProducts
    });
  } catch (error) {
    next(error);
  }
};

exports.getTopRatedProducts = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const topRated = await Product.find({ isActive: true })
      .populate('category', 'name')
      .sort({ ratingAverage: -1, ratingCount: -1 })
      .limit(limit);

    res.status(200).json({
      success: true,
      data: topRated
    });
  } catch (error) {
    next(error);
  }
};

exports.getOrderStatusDistribution = async (req, res, next) => {
  try {
    const distribution = await Order.aggregate([
      {
        $group: {
          _id: '$orderStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    const statuses = ['pending', 'confirmed', 'processing', 'shipping', 'delivered', 'cancelled'];
    const data = statuses.map(status => {
      const found = distribution.find(d => d._id === status);
      return {
        status,
        count: found?.count || 0
      };
    });

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

exports.getPaymentMethodDistribution = async (req, res, next) => {
  try {
    const distribution = await Order.aggregate([
      {
        $match: { paymentStatus: 'completed' }
      },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          total: { $sum: '$totalAmount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: distribution
    });
  } catch (error) {
    next(error);
  }
};

exports.getUserStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments({ isActive: true });
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const customerUsers = await User.countDocuments({ role: 'customer' });
    
    // Users by provider
    const byProvider = await User.aggregate([
      {
        $group: {
          _id: '$provider',
          count: { $sum: 1 }
        }
      }
    ]);

    // New users this month
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    const newThisMonth = await User.countDocuments({
      createdAt: { $gte: thisMonthStart }
    });

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        adminUsers,
        customerUsers,
        newThisMonth,
        byProvider
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getProductStats = async (req, res, next) => {
  try {
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ isActive: true });
    const lowStockProducts = await Product.countDocuments({ quantity: { $lt: 5 } });
    const outOfStockProducts = await Product.countDocuments({ quantity: 0 });

    // Average rating
    const ratingStats = await Product.aggregate([
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$ratingAverage' },
          avgComments: { $avg: '$commentCount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalProducts,
        activeProducts,
        lowStockProducts,
        outOfStockProducts,
        avgRating: ratingStats[0]?.avgRating || 0,
        avgComments: ratingStats[0]?.avgComments || 0
      }
    });
  } catch (error) {
    next(error);
  }
};
