const Order = require('../models/Order');

const formatShippingAddress = (address = {}) => {
  return [
    address.street || address.address,
    address.ward,
    address.district,
    address.province,
    address.postalCode
  ].filter(Boolean).join(', ');
};

const normalizeStatus = (status) => {
  return status === 'shipping' ? 'shipped' : status;
};

exports.createOrder = (payload) => {
  const order = new Order(payload);
  return order.save();
};

exports.findOrders = (filter = {}) => {
  return Order.find(filter)
    .populate('user', 'fullName email phone')
    .populate('items.product', 'name slug image images')
    .sort({ createdAt: -1 });
};

exports.findOrderById = (orderId) => {
  return Order.findById(orderId)
    .populate('user', 'fullName email phone')
    .populate('items.product', 'name slug image images');
};

exports.updateOrder = (orderId, updateData) => {
  return Order.findByIdAndUpdate(orderId, updateData, {
    new: true,
    runValidators: true
  })
    .populate('user', 'fullName email phone')
    .populate('items.product', 'name slug image images');
};

exports.formatOrder = (orderDoc) => {
  const order = orderDoc.toObject ? orderDoc.toObject() : orderDoc;
  const shippingAddress = formatShippingAddress(order.shippingAddress);

  return {
    ...order,
    shippingAddress,
    shippingAddressData: order.shippingAddress,
    orderStatus: normalizeStatus(order.orderStatus)
  };
};