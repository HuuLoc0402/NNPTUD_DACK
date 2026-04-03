const User = require('../models/User');

exports.createUser = async (payload) => {
  const user = new User(payload);
  await user.save();
  return user;
};

exports.findUserByEmail = (email) => {
  return User.findOne({ email: String(email).toLowerCase() });
};

exports.findUserByEmailWithPassword = (email) => {
  return User.findOne({ email: String(email).toLowerCase() }).select('+password');
};

exports.findUserById = (userId) => {
  return User.findById(userId);
};

exports.findUserByRefreshToken = (refreshToken) => {
  return User.findOne({ refreshToken });
};

exports.saveUser = async (user) => {
  await user.save();
  return user;
};

exports.updateUserProfile = (userId, updateData) => {
  return User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true
  });
};

exports.toggleUserStatus = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    return null;
  }

  user.isActive = !user.isActive;
  await user.save();
  return user;
};

exports.updateUserRole = async (userId, role) => {
  return User.findByIdAndUpdate(userId, { role }, { new: true, runValidators: true });
};

exports.findUsers = (filter = {}, options = {}) => {
  return User.find(filter)
    .sort(options.sort || { createdAt: -1 })
    .limit(options.limit || 0)
    .skip(options.skip || 0);
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
