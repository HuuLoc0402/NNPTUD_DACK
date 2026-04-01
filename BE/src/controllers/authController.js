const User = require('../models/User');
const TokenManager = require('../utils/tokenManager');
const EmailSender = require('../utils/emailSender');
const { validateLogin, validateRegister } = require('../utils/validator');
const { AppError } = require('../middleware/errorHandler');

exports.register = async (req, res, next) => {
  try {
    const { fullName, email, password, confirmPassword, phone } = req.body;

    // Validate input
    const validation = validateRegister(fullName, email, password, confirmPassword, phone);
    if (!validation.isValid) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ 
        success: false,
        message: 'Email này đã được đăng ký' 
      });
    }

    // Create new user
    user = new User({
      fullName,
      email,
      password,
      phone,
      provider: 'local',
      role: 'user'
    });

    await user.save();

    // Send welcome email
    try {
      await EmailSender.sendWelcomeEmail(email, fullName);
    } catch (error) {
      console.error('Error sending welcome email:', error);
    }

    // Generate tokens
    const { accessToken, refreshToken, expiresIn } = TokenManager.generateTokenPair(
      user._id,
      user.role
    );

    // Save refresh token to user
    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công',
      user: user.toJSON(),
      accessToken,
      refreshToken,
      expiresIn
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input
    const validation = validateLogin(email, password);
    if (!validation.isValid) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    // Get user with password field
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Email hoặc mật khẩu không chính xác' 
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        success: false,
        message: 'Tài khoản này đã bị vô hiệu hóa' 
      });
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({ 
        success: false,
        message: 'Email hoặc mật khẩu không chính xác' 
      });
    }

    // Update last login
    user.lastLogin = new Date();

    // Generate tokens
    const { accessToken, refreshToken, expiresIn } = TokenManager.generateTokenPair(
      user._id,
      user.role
    );

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      user: user.toJSON(),
      accessToken,
      refreshToken,
      expiresIn
    });
  } catch (error) {
    next(error);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    // Verify refresh token
    const decoded = TokenManager.verifyRefreshToken(refreshToken);

    // Get user
    const user = await User.findById(decoded.userId);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // Generate new tokens
    const { accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn } = TokenManager.generateTokenPair(
      user._id,
      user.role
    );

    // Save new refresh token
    user.refreshToken = newRefreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn
    });
  } catch (error) {
    res.status(401).json({ message: 'Invalid refresh token', error: error.message });
  }
};

exports.logout = async (req, res, next) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId);
    if (user) {
      user.refreshToken = null;
      await user.save();
    }

    res.status(200).json({ success: true, message: 'Logout successful' });
  } catch (error) {
    next(error);
  }
};

exports.googleCallback = async (req, res, next) => {
  try {
    const { id, email, displayName, picture } = req.body;

    let user = await User.findOne({ googleId: id });

    if (!user) {
      // Create new user
      user = new User({
        fullName: displayName,
        email,
        avatar: picture,
        googleId: id,
        provider: 'google'
      });
      await user.save();
      await EmailSender.sendWelcomeEmail(email, displayName);
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const { accessToken, refreshToken, expiresIn } = TokenManager.generateTokenPair(
      user._id,
      user.role
    );

    user.refreshToken = refreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      user: user.toJSON(),
      accessToken,
      refreshToken,
      expiresIn
    });
  } catch (error) {
    next(error);
  }
};

exports.facebookCallback = async (req, res, next) => {
  try {
    const { id, email, displayName, picture } = req.body;

    let user = await User.findOne({ facebookId: id });

    if (!user) {
      // Create new user
      user = new User({
        fullName: displayName,
        email,
        avatar: picture?.data?.url,
        facebookId: id,
        provider: 'facebook'
      });
      await user.save();
      if (email) {
        await EmailSender.sendWelcomeEmail(email, displayName);
      }
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const { accessToken, refreshToken, expiresIn } = TokenManager.generateTokenPair(
      user._id,
      user.role
    );

    user.refreshToken = refreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      user: user.toJSON(),
      accessToken,
      refreshToken,
      expiresIn
    });
  } catch (error) {
    next(error);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      user: user.toJSON()
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { fullName, phone, address } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        fullName,
        phone,
        address
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: user.toJSON()
    });
  } catch (error) {
    next(error);
  }
};
