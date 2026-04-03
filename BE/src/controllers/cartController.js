const Cart = require('../models/Cart');

exports.findCartByUser = (userId) => {
  return Cart.findOne({ user: userId }).populate({
    path: 'items.product',
    populate: { path: 'category', select: 'name slug' }
  });
};

exports.createCart = (userId) => {
  const cart = new Cart({ user: userId, items: [] });
  return cart.save();
};

exports.findOrCreateCart = async (userId) => {
  let cart = await exports.findCartByUser(userId);
  if (!cart) {
    cart = await exports.createCart(userId);
    cart = await exports.findCartByUser(userId);
  }
  return cart;
};

exports.saveCart = async (cart) => {
  await cart.save();
  return cart.populate({
    path: 'items.product',
    populate: { path: 'category', select: 'name slug' }
  });
};

exports.clearCart = async (userId) => {
  const cart = await exports.findOrCreateCart(userId);
  cart.items = [];
  await cart.save();
  return cart;
};