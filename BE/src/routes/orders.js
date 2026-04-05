const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const Comment = require('../models/Comment');
const cartController = require('../controllers/cartController');
const orderController = require('../controllers/orderController');
const { authenticate, adminOnly } = require('../middleware/auth');
const { findMatchingVariant, getImagesForColor, normalizeColorName } = require('../utils/productVariant');
const { validateOrderInventory, applyInventoryForOrder, revertInventoryForOrder } = require('../utils/orderInventory');
const { sendInvoiceEmailForCompletedOrder } = require('../utils/invoiceMailer');

const router = express.Router();

const buildShippingAddress = (shippingAddress = {}) => ({
  fullName: shippingAddress.fullName || shippingAddress.fullname || '',
  phone: shippingAddress.phone || '',
  email: shippingAddress.email || '',
  street: shippingAddress.street || shippingAddress.address || '',
  ward: shippingAddress.ward || '',
  district: shippingAddress.district || '',
  province: shippingAddress.province || '',
  postalCode: shippingAddress.postalCode || ''
});

const buildOrderItem = (product, item) => {
  const size = item.selectedSize || item.size || 'M';
  const color = normalizeColorName(item.selectedColor || item.color || 'Mac dinh');
  const quantity = Number(item.quantity || 1);
  const variant = findMatchingVariant(product, { size, color });
  const price = variant?.price || product.finalPrice || product.price;
  const discount = product.discount || 0;
  const image = getImagesForColor(product, color)[0]?.url || product.image || null;

  return {
    product: product._id,
    productName: product.name,
    productImage: image,
    quantity,
    selectedSize: size,
    selectedColor: color,
    price,
    discount,
    totalPrice: price * quantity * (1 - discount / 100)
  };
};

const canAccessOrder = (order, req) => {
  return req.userRole === 'admin' || String(order.user?._id || order.user) === String(req.userId);
};

const isOrderVisible = (order) => {
  return String(order?.paymentMethod || '').toLowerCase() === 'cod' || order?.paymentStatus === 'completed';
};

const buildVisibleOrdersFilter = (extraFilter = {}) => ({
  ...extraFilter,
  $or: [
    { paymentMethod: 'cod' },
    { paymentStatus: 'completed' }
  ]
});

const recalculateProductCommentStats = async (productIds = []) => {
  const uniqueProductIds = Array.from(new Set(productIds.map((productId) => String(productId || '')).filter(Boolean)));

  await Promise.all(uniqueProductIds.map(async (productId) => {
    const stats = await Comment.aggregate([
      {
        $match: {
          product: new mongoose.Types.ObjectId(productId),
          isApproved: true
        }
      },
      {
        $group: {
          _id: '$product',
          ratingAverage: { $avg: '$rating' },
          commentCount: { $sum: 1 }
        }
      }
    ]);

    const summary = stats[0] || { ratingAverage: 0, commentCount: 0 };
    await Product.findByIdAndUpdate(productId, {
      ratingAverage: Number(Number(summary.ratingAverage || 0).toFixed(1)),
      commentCount: summary.commentCount || 0
    });
  }));
};

router.post('/', authenticate, async (req, res, next) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ success: false, message: 'Order items are required' });
    }

    const orderItems = [];
    for (const item of items) {
      const productId = item.productId || item.product;
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ success: false, message: 'Invalid product in order' });
      }

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      orderItems.push(buildOrderItem(product, item));
    }

    const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const shippingFee = Number(req.body.shippingCost || req.body.shippingFee || 0);
    const tax = Number(req.body.tax || 0);
    const discount = Number(req.body.discount || 0);
    const totalAmount = Number(req.body.totalAmount || subtotal + shippingFee + tax - discount);

    const stockValidation = await validateOrderInventory({ items: orderItems });
    if (!stockValidation.ok) {
      return res.status(400).json({ success: false, message: stockValidation.message });
    }

    const order = await orderController.createOrder({
      orderCode: `ORD${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      user: req.userId,
      items: orderItems,
      shippingAddress: buildShippingAddress(req.body.shippingAddress),
      totalItems: orderItems.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      shippingFee,
      tax,
      discount,
      totalAmount,
      paymentMethod: req.body.paymentMethod || 'cod',
      paymentStatus: 'pending',
      orderStatus: 'pending',
      notes: req.body.notes || ''
    });

    if ((req.body.paymentMethod || 'cod') !== 'vnpay') {
      try {
        await applyInventoryForOrder(order);
      } catch (error) {
        return res.status(400).json({ success: false, message: error.message || 'Không thể cập nhật tồn kho cho đơn hàng.' });
      }

      try {
        await cartController.clearCart(req.userId);
      } catch (error) {
        console.error('Clear cart after order error:', error.message);
      }
    }

    const populatedOrder = await orderController.findOrderById(order._id);
    return res.status(201).json({ success: true, data: orderController.formatOrder(populatedOrder) });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/all', authenticate, adminOnly, async (req, res, next) => {
  try {
    const orders = await orderController.findOrders(buildVisibleOrdersFilter());
    return res.status(200).json({ success: true, data: orders.map(orderController.formatOrder) });
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const orders = await orderController.findOrders(buildVisibleOrdersFilter({ user: req.userId }));
    return res.status(200).json({ success: true, data: orders.map(orderController.formatOrder) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const order = await orderController.findOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!canAccessOrder(order, req)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem đơn hàng này' });
    }

    if (req.userRole !== 'admin' && !isOrderVisible(order)) {
      return res.status(404).json({ success: false, message: 'Đơn hàng chưa hoàn tất thanh toán.' });
    }

    return res.status(200).json({ success: true, data: orderController.formatOrder(order) });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/cancel', authenticate, async (req, res, next) => {
  try {
    const order = await orderController.findOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!canAccessOrder(order, req)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền hủy đơn hàng này' });
    }

    if (['cancelled', 'delivered', 'completed'].includes(order.orderStatus)) {
      return res.status(400).json({ success: false, message: 'Không thể hủy đơn hàng ở trạng thái hiện tại' });
    }

    const updatedOrder = await orderController.updateOrder(req.params.id, {
      orderStatus: 'cancelled',
      paymentStatus: order.paymentStatus === 'completed' ? order.paymentStatus : 'cancelled',
      cancelledAt: new Date(),
      cancelReason: req.body.cancelReason || ''
    });

    return res.status(200).json({ success: true, data: orderController.formatOrder(updatedOrder) });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/status', authenticate, adminOnly, async (req, res, next) => {
  try {
    const updateData = { orderStatus: req.body.orderStatus === 'shipped' ? 'shipping' : req.body.orderStatus };

    if (updateData.orderStatus === 'delivered') {
      updateData.deliveredAt = new Date();
    }

    if (updateData.orderStatus === 'completed') {
      updateData.completedAt = new Date();
      updateData.paymentStatus = 'completed';
      if (!updateData.deliveredAt) {
        updateData.deliveredAt = new Date();
      }
    }

    if (updateData.orderStatus === 'cancelled') {
      updateData.cancelledAt = new Date();
    }

    const order = await orderController.updateOrder(req.params.id, updateData);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (['delivered', 'completed'].includes(updateData.orderStatus) && !order.inventoryAdjustedAt) {
      try {
        await applyInventoryForOrder(order);
      } catch (error) {
        return res.status(400).json({ success: false, message: error.message || 'Không thể cập nhật tồn kho cho đơn hàng.' });
      }
    }

    if (order.paymentStatus === 'completed') {
      const invoiceResult = await sendInvoiceEmailForCompletedOrder({ order });
      if (!invoiceResult.success && !invoiceResult.skipped) {
        console.error('Send invoice email after admin completion error:', invoiceResult.error || invoiceResult.reason);
      }
    }

    return res.status(200).json({ success: true, data: orderController.formatOrder(order) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, adminOnly, async (req, res, next) => {
  try {
    const order = await orderController.findOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const relatedComments = await Comment.find({ order: order._id }).select('product').lean();

    if (order.inventoryAdjustedAt) {
      await revertInventoryForOrder(order);
    }

    await Promise.all([
      Payment.deleteMany({ order: order._id }),
      Comment.deleteMany({ order: order._id })
    ]);

    await recalculateProductCommentStats(relatedComments.map((comment) => comment.product));
    await orderController.deleteOrder(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Đã xóa đơn hàng thành công.'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;