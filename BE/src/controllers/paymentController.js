const Payment = require('../models/Payment');

exports.createPayment = (payload) => {
  const payment = new Payment(payload);
  return payment.save();
};

exports.findPaymentById = (paymentId) => {
  return Payment.findById(paymentId).populate('order').populate('user', 'fullName email phone');
};

exports.findPaymentByOrder = (orderId) => {
  return Payment.findOne({ order: orderId }).sort({ createdAt: -1 });
};

exports.updatePayment = (paymentId, updateData) => {
  return Payment.findByIdAndUpdate(paymentId, updateData, {
    new: true,
    runValidators: true
  }).populate('order').populate('user', 'fullName email phone');
};

exports.findPayments = (filter = {}) => {
  return Payment.find(filter).populate('order').populate('user', 'fullName email phone');
};