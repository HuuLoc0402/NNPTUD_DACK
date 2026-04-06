const express = require('express');
const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const Order = require('../models/Order');
const Product = require('../models/Product');
const CommunityFilter = require('../utils/communityFilter');
const commentController = require('../controllers/commentController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { buildUploadedFileUrl, deleteUploadFiles } = require('../utils/uploadStorage');

const router = express.Router();

const buildAdminReplyPayload = (user, content, existingReply = null) => ({
  content,
  repliedBy: user._id,
  adminName: user.fullName || 'Admin',
  adminAvatar: user.avatar || null,
  createdAt: existingReply?.createdAt || new Date(),
  updatedAt: new Date()
});

const findAnyPurchasedOrder = (userId, productId) => Order.findOne({
  user: userId,
  'items.product': productId,
  orderStatus: { $ne: 'cancelled' }
}).sort({ createdAt: -1 });

const findEligiblePaidOrder = (userId, productId) => Order.findOne({
  user: userId,
  'items.product': productId,
  orderStatus: { $ne: 'cancelled' },
  paymentStatus: 'completed'
}).sort({ createdAt: -1 });

const findExistingRatedComment = (userId, productId) => Comment.findOne({
  user: userId,
  product: productId,
  rating: { $gte: 1 }
}).sort({ createdAt: -1 });

const buildCommentEligibility = async (userId, productId) => {
  const [purchasedOrder, paidOrder, existingComment, ratedComment] = await Promise.all([
    findAnyPurchasedOrder(userId, productId),
    findEligiblePaidOrder(userId, productId),
    Comment.findOne({ user: userId, product: productId }).sort({ createdAt: -1 }),
    findExistingRatedComment(userId, productId)
  ]);

  if (!purchasedOrder) {
    return {
      canComment: false,
      hasPurchased: false,
      hasCompletedPayment: false,
      hasCommented: false,
      hasRated: false,
      message: 'Bạn cần mua sản phẩm này trước khi đánh giá.',
      order: null,
      comment: null,
      ratedComment: null
    };
  }

  if (!paidOrder) {
    return {
      canComment: false,
      hasPurchased: true,
      hasCompletedPayment: false,
      hasCommented: Boolean(existingComment),
      hasRated: Boolean(ratedComment),
      message: 'Bạn chỉ có thể đánh giá sau khi đã mua và thanh toán thành công sản phẩm này.',
      order: purchasedOrder,
      comment: existingComment || null,
      ratedComment: ratedComment || null
    };
  }

  return {
    canComment: true,
    hasPurchased: true,
    hasCompletedPayment: true,
    hasCommented: Boolean(existingComment),
    hasRated: Boolean(ratedComment),
    message: 'Bạn có thể gửi đánh giá cho sản phẩm này.',
    order: paidOrder,
    comment: existingComment || null,
    ratedComment: ratedComment || null
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
        ratingTotal: {
          $sum: {
            $cond: [{ $gte: ['$rating', 1] }, '$rating', 0]
          }
        },
        ratingCount: {
          $sum: {
            $cond: [{ $gte: ['$rating', 1] }, 1, 0]
          }
        },
        commentCount: { $sum: 1 }
      }
    }
  ]);

  const result = stats[0] || { ratingTotal: 0, ratingCount: 0, commentCount: 0 };
  const ratingAverage = result.ratingCount > 0 ? result.ratingTotal / result.ratingCount : 0;
  await Product.findByIdAndUpdate(productId, {
    ratingAverage: Number(ratingAverage || 0).toFixed ? Number(Number(ratingAverage || 0).toFixed(1)) : 0,
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
        hasRated: eligibility.hasRated,
        message: eligibility.message,
        orderId: eligibility.order?._id || null,
        commentId: eligibility.comment?._id || null,
        ratedCommentId: eligibility.ratedComment?._id || null
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, upload.array('images', 5), async (req, res, next) => {
  try {
    const productId = req.body.productId || req.body.product;
    const rawRating = String(req.body.rating ?? '').trim();
    const rating = rawRating ? Number(rawRating) : null;
    const title = req.body.title || '';
    const content = req.body.content || '';
    const uploadedImageUrls = Array.isArray(req.files)
      ? req.files.map((file) => buildUploadedFileUrl(file)).filter(Boolean)
      : [];

    if (!productId || !content) {
      await deleteUploadFiles(uploadedImageUrls);
      return res.status(400).json({ success: false, message: 'Thiếu dữ liệu đánh giá' });
    }

    if (rawRating && (!Number.isFinite(rating) || rating < 1 || rating > 5)) {
      await deleteUploadFiles(uploadedImageUrls);
      return res.status(400).json({ success: false, message: 'Số sao đánh giá phải từ 1 đến 5.' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      await deleteUploadFiles(uploadedImageUrls);
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const eligibility = await buildCommentEligibility(req.userId, productId);
    if (!eligibility.canComment) {
      await deleteUploadFiles(uploadedImageUrls);
      return res.status(403).json({
        success: false,
        message: eligibility.message
      });
    }

    if (!eligibility.hasRated && !rawRating) {
      await deleteUploadFiles(uploadedImageUrls);
      return res.status(400).json({ success: false, message: 'Bạn cần chấm sao ở lần đánh giá đầu tiên.' });
    }

    if (eligibility.hasRated && rawRating) {
      await deleteUploadFiles(uploadedImageUrls);
      return res.status(409).json({ success: false, message: 'Bạn chỉ được chấm sao 1 lần cho sản phẩm này. Các lần sau chỉ có thể bình luận thêm.' });
    }

    const analysis = CommunityFilter.analyzeContent(`${title} ${content}`.trim());
    const comment = await commentController.createComment({
      product: productId,
      user: req.userId,
      order: eligibility.order._id,
      rating: rawRating ? rating : undefined,
      title,
      content,
      images: uploadedImageUrls.map((url) => ({ url })),
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
    const uploadedImageUrls = Array.isArray(req.files)
      ? req.files.map((file) => buildUploadedFileUrl(file)).filter(Boolean)
      : [];
    await deleteUploadFiles(uploadedImageUrls);
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

router.put('/:commentId/reply', authenticate, async (req, res, next) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Chỉ admin mới có thể phản hồi đánh giá' });
    }

    const currentComment = await commentController.findCommentById(req.params.commentId);
    if (!currentComment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const content = String(req.body.content || '').trim();
    if (!content) {
      return res.status(400).json({ success: false, message: 'Nội dung phản hồi không được để trống' });
    }

    const comment = await commentController.updateComment(req.params.commentId, {
      adminReply: buildAdminReplyPayload(req.user, content, currentComment.adminReply)
    });

    return res.status(200).json({ success: true, data: commentController.formatComment(comment) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:commentId/reply', authenticate, async (req, res, next) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Chỉ admin mới có thể xóa phản hồi đánh giá' });
    }

    const currentComment = await commentController.findCommentById(req.params.commentId);
    if (!currentComment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    if (!currentComment.adminReply?.content) {
      return res.status(404).json({ success: false, message: 'Đánh giá này chưa có phản hồi từ admin' });
    }

    await Comment.findByIdAndUpdate(req.params.commentId, {
      $unset: { adminReply: 1 }
    });

    const updatedComment = await commentController.findCommentById(req.params.commentId);
    return res.status(200).json({ success: true, data: commentController.formatComment(updatedComment) });
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
    await deleteUploadFiles((currentComment.images || []).map((image) => image?.url).filter(Boolean));
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