const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.authenticate = async (req, res, next) => {
  try {
    // Get token from header
    let token = req.headers.authorization;
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Không có token được cung cấp' 
      });
    }

    // Remove 'Bearer ' prefix if present
    if (token.startsWith('Bearer ')) {
      token = token.slice(7);
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from token
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Không tìm thấy người dùng' 
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        success: false,
        message: 'Tài khoản này đã bị vô hiệu hóa' 
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id;
    req.userRole = user.role;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token đã hết hạn' 
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token không hợp lệ' 
      });
    }
    res.status(500).json({ 
      success: false,
      message: 'Xác thực thất bại', 
      error: error.message 
    });
  }
};

/**
 * Authorization middleware
 * Checks if user has one of the required roles
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ 
        success: false,
        message: 'Bạn không có quyền truy cập tài nguyên này' 
      });
    }
    next();
  };
};

/**
 * Admin-only middleware (shorthand)
 */
exports.adminOnly = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ 
      success: false,
      message: 'Chỉ admin mới có thể truy cập' 
    });
  }
  next();
};
