const express = require('express');
const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const Order = require('../models/Order');
const Product = require('../models/Product');
const CommunityFilter = require('../utils/communityFilter');
const commentController = require('../controllers/commentController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const findAnyPurchasedOrder = (userId, productId) => Order.findOne({
  user: userId,
  'items.product': productId,
  orderStatus: { $ne: 'cancelled' }
}).sort({ createdAt: -1 });

const findEligibleCompletedOrder = (userId, productId) => Order.findOne({
  user: userId,
  'items.product': productId,
  orderStatus: 'completed',
  paymentStatus: 'completed'
}).sort({ createdAt: -1 });

const buildCommentEligibility = async (userId, productId) => {
  const [purchasedOrder, completedOrder, existingComment] = await Promise.all([
    findAnyPurchasedOrder(userId, productId),
    findEligibleCompletedOrder(userId, productId),
    Comment.findOne({ user: userId, product: productId }).sort({ createdAt: -1 })
  ]);

  if (existingComment) {
    return {
      canComment: false,
      hasPurchased: true,
      hasCompletedPayment: true,
      hasCommented: true,
      message: 'Bạn đã đánh giá sản phẩm này rồi.',
      order: completedOrder || purchasedOrder,
      comment: existingComment
    };
  }

  if (!purchasedOrder) {
    return {
      canComment: false,
      hasPurchased: false,
      hasCompletedPayment: false,
      hasCommented: false,
      message: 'Bạn cần mua sản phẩm này trước khi đánh giá.',
      order: null,
      comment: null
    };
  }

  if (!completedOrder) {
    return {
      canComment: false,
      hasPurchased: true,
      hasCompletedPayment: false,
      hasCommented: false,
      message: 'Bạn chỉ có thể đánh giá sau khi đơn hàng đã thanh toán thành công và được admin hoàn tất.',
      order: purchasedOrder,
      comment: null
    };
  }

  return {
    canComment: true,
    hasPurchased: true,
    hasCompletedPayment: true,
    hasCommented: false,
    message: 'Bạn có thể gửi đánh giá cho sản phẩm này.',
    order: completedOrder,
    comment: null
  };
};

const updateProductCommentStats = async (productId) => {
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

  const result = stats[0] || { ratingAverage: 0, commentCount: 0 };
  await Product.findByIdAndUpdate(productId, {
    ratingAverage: Number(result.ratingAverage || 0).toFixed ? Number(Number(result.ratingAverage || 0).toFixed(1)) : 0,
    commentCount: result.commentCount || 0
  });
};

router.get('/product/:productId', async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;
    const comments = await Comment.find({ product: req.params.productId, isApproved: true })
      .populate('user', 'fullName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      data: comments.map(commentController.formatComment)
    });
  } catch (error) {
    next(error);
  }
});

router.get('/product/:productId/eligibility', authenticate, async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.productId).select('_id');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const eligibility = await buildCommentEligibility(req.userId, req.params.productId);
    return res.status(200).json({
      success: true,
      data: {
        canComment: eligibility.canComment,
        hasPurchased: eligibility.hasPurchased,
        hasCompletedPayment: eligibility.hasCompletedPayment,
        hasCommented: eligibility.hasCommented,
        message: eligibility.message,
        orderId: eligibility.order?._id || null,
        commentId: eligibility.comment?._id || null
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const productId = req.body.productId || req.body.product;
    const rating = Number(req.body.rating || 0);
    const title = req.body.title || '';
    const content = req.body.content || '';

    if (!productId || !rating || !content) {
      return res.status(400).json({ success: false, message: 'Thiếu dữ liệu đánh giá' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const eligibility = await buildCommentEligibility(req.userId, productId);
    if (!eligibility.canComment) {
      return res.status(eligibility.hasCommented ? 409 : 403).json({
        success: false,
        message: eligibility.message
      });
    }

    const analysis = CommunityFilter.analyzeContent(`${title} ${content}`.trim());
    const comment = await commentController.createComment({
      product: productId,
      user: req.userId,
      order: eligibility.order._id,
      rating,
      title,
      content,
      isVerified: true,
      violationDetected: analysis.detected || false,
      violationType: analysis.type || 'none',
      violationDetails: analysis.details || '',
      status: analysis.detected ? 'pending' : 'approved',
      isApproved: !analysis.detected
    });

    if (!analysis.detected) {
      await updateProductCommentStats(productId);
    }

    const savedComment = await commentController.findCommentById(comment._id);
    return res.status(201).json({ success: true, data: commentController.formatComment(savedComment) });
  } catch (error) {
    next(error);
  }
});

router.put('/:commentId', authenticate, async (req, res, next) => {
  try {
    const currentComment = await commentController.findCommentById(req.params.commentId);
    if (!currentComment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    if (req.userRole !== 'admin' && String(currentComment.user?._id || currentComment.user) !== String(req.userId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền sửa đánh giá này' });
    }

    const content = req.body.content ?? currentComment.content;
    const title = req.body.title ?? currentComment.title;
    const rating = req.body.rating ?? currentComment.rating;
    const analysis = CommunityFilter.analyzeContent(`${title} ${content}`.trim());
    const comment = await commentController.updateComment(req.params.commentId, {
      title,
      content,
      rating,
      violationDetected: analysis.detected || false,
      violationType: analysis.type || 'none',
      violationDetails: analysis.details || '',
      status: analysis.detected ? 'pending' : 'approved',
      isApproved: !analysis.detected
    });

    await updateProductCommentStats(currentComment.product?._id || currentComment.product);
    return res.status(200).json({ success: true, data: commentController.formatComment(comment) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:commentId', authenticate, async (req, res, next) => {
  try {
    const currentComment = await commentController.findCommentById(req.params.commentId);
    if (!currentComment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    if (req.userRole !== 'admin' && String(currentComment.user?._id || currentComment.user) !== String(req.userId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa đánh giá này' });
    }

    await commentController.deleteComment(req.params.commentId);
    await updateProductCommentStats(currentComment.product?._id || currentComment.product);

    return res.status(200).json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/:commentId/helpful', async (req, res, next) => {
  try {
    const comment = await commentController.findCommentById(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    if (req.body.helpful) {
      comment.helpful += 1;
    } else {
      comment.notHelpful += 1;
    }

    await comment.save();
    return res.status(200).json({ success: true, data: commentController.formatComment(comment) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;