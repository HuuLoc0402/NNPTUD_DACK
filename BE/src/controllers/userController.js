const User = require('../models/User');

exports.findUsers = (filter = {}) => {
  return User.find(filter).sort({ createdAt: -1 });
};

exports.findUserById = (userId) => {
  return User.findById(userId);
};

exports.findUserByEmail = (email) => {
  return User.findOne({ email: String(email).toLowerCase() });
};

exports.createUser = (payload) => {
  const user = new User(payload);
  return user.save();
};

exports.updateUserRole = (userId, role) => {
  return User.findByIdAndUpdate(userId, { role }, { new: true, runValidators: true });
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