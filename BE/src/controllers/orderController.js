const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const User = require('../models/User');
const EmailSender = require('../utils/emailSender');
const mongoose = require('mongoose');

exports.createOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.userId;
    const { shippingAddress, paymentMethod } = req.body;

    // Get user cart
    const cart = await Cart.findOne({ user: userId }).session(session);

    if (!cart || cart.items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Validate and update product stock
    for (let item of cart.items) {
      const product = await Product.findById(item.product).session(session);

      if (!product) {
        await session.abortTransaction();
        return res.status(404).json({ message: `Product ${item.product} not found` });
      }

      if (product.quantity < item.quantity) {
        await session.abortTransaction();
        return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
      }

      // Update stock
      product.quantity -= item.quantity;
      await product.save({ session });
    }

    // Create order items
    const orderItems = cart.items.map(item => ({
      product: item.product._id,
      productName: item.product.name,
      productImage: item.product.image,
      quantity: item.quantity,
      selectedSize: item.selectedSize,
      selectedColor: item.selectedColor,
      price: item.price,
      discount: item.discount,
      totalPrice: item.quantity * item.price * (1 - item.discount / 100)
    }));

    // Calculate totals
    const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const shippingFee = 0; // Can be calculated based on address
    const tax = subtotal * 0.1; // 10% tax
    const totalAmount = subtotal + shippingFee + tax;

    // Create order
    const order = new Order({
      user: userId,
      items: orderItems,
      shippingAddress,
      totalItems: cart.totalItems,
      subtotal,
      shippingFee,
      tax,
      totalAmount,
      paymentMethod,
      paymentStatus: 'pending',
      orderStatus: 'pending'
    });

    await order.save({ session });

    // Clear cart
    cart.items = [];
    await cart.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Get updated order with populated user info
    const populatedOrder = await Order.findById(order._id)
      .populate('user')
      .populate('items.product');

    // Send confirmation email
    const user = await User.findById(userId);
    await EmailSender.sendOrderConfirmation(user.email, {
      ...populatedOrder.toObject(),
      fullName: user.fullName
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: populatedOrder,
      nextStep: paymentMethod === 'cod' ? 'Order confirmed' : 'Proceed to payment'
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const userId = req.userId;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const filter = { user: userId };
    if (status) {
      filter.orderStatus = status;
    }

    const orders = await Order.find(filter)
      .populate('items.product')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;

    const order = await Order.findOne({
      _id: orderId,
      user: userId
    }).populate('items.product');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    next(error);
  }
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { orderStatus } = req.body;

    const order = await Order.findByIdAndUpdate(
      orderId,
      { orderStatus },
      { new: true, runValidators: true }
    ).populate('items.product');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Order status updated',
      order
    });
  } catch (error) {
    next(error);
  }
};

exports.cancelOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;
    const { cancelReason } = req.body;
    const userId = req.userId;

    const order = await Order.findOne({
      _id: orderId,
      user: userId
    }).session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Order not found' });
    }

    if (['shipped', 'delivered'].includes(order.orderStatus)) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Cannot cancel shipped orders' });
    }

    // Restore product stock
    for (let item of order.items) {
      const product = await Product.findById(item.product).session(session);
      if (product) {
        product.quantity += item.quantity;
        await product.save({ session });
      }
    }

    order.orderStatus = 'cancelled';
    order.cancelReason = cancelReason;
    order.cancelledAt = new Date();
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      order
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

exports.getAllOrders = async (req, res, next) => {
  try {
    // Admin only
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const filter = {};
    if (status) {
      filter.orderStatus = status;
    }

    const orders = await Order.find(filter)
      .populate('user', 'fullName email phone')
      .populate('items.product', 'name image price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};
