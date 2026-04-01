const Comment = require('../models/Comment');
const Product = require('../models/Product');
const Order = require('../models/Order');
const CommunityFilter = require('../utils/communityFilter');

exports.createComment = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { productId, orderId, rating, title, content } = req.body;

    // Verify product purchase (check if user has completed order with this product)
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      paymentStatus: 'completed'
    });

    if (!order) {
      return res.status(400).json({ 
        message: 'You can only comment on products you have purchased' 
      });
    }

    // Check if product in order
    const productInOrder = order.items.some(item => item.product.toString() === productId);
    if (!productInOrder) {
      return res.status(400).json({ 
        message: 'This product is not in your order' 
      });
    }

    // Check for community violations
    const violationCheck = CommunityFilter.analyzeContent(content);
    let isVerified = !violationCheck.detected;

    const comment = new Comment({
      product: productId,
      user: userId,
      order: orderId,
      rating,
      title,
      content,
      violationDetected: violationCheck.detected,
      violationType: violationCheck.type,
      violationDetails: violationCheck.details,
      isVerified,
      status: violationCheck.detected ? 'rejected' : 'approved',
      isApproved: !violationCheck.detected
    });

    await comment.save();

    // Update product rating
    const allComments = await Comment.find({
      product: productId,
      isApproved: true
    });

    if (allComments.length > 0) {
      const avgRating = allComments.reduce((sum, c) => sum + c.rating, 0) / allComments.length;
      await Product.findByIdAndUpdate(
        productId,
        {
          ratingAverage: avgRating,
          ratingCount: allComments.length,
          commentCount: allComments.length
        }
      );
    }

    res.status(201).json({
      success: true,
      message: violationCheck.detected 
        ? 'Comment contains community violations and cannot be posted' 
        : 'Comment posted successfully',
      comment,
      violationDetected: violationCheck.detected
    });
  } catch (error) {
    next(error);
  }
};

exports.getProductComments = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const comments = await Comment.find({
      product: productId,
      isApproved: true,
      status: 'approved'
    })
      .populate('user', 'fullName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments({
      product: productId,
      isApproved: true,
      status: 'approved'
    });

    // Get rating distribution
    const ratingDistribution = {};
    for (let i = 1; i <= 5; i++) {
      ratingDistribution[i] = await Comment.countDocuments({
        product: productId,
        rating: i,
        isApproved: true
      });
    }

    res.status(200).json({
      success: true,
      data: comments,
      ratingDistribution,
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

exports.updateComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const userId = req.userId;
    const { rating, title, content } = req.body;

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (comment.user.toString() !== userId) {
      return res.status(403).json({ message: 'Cannot edit others comment' });
    }

    if (comment.isApproved) {
      return res.status(400).json({ message: 'Cannot edit approved comments' });
    }

    // Check for violations
    const violationCheck = CommunityFilter.analyzeContent(content);

    comment.rating = rating || comment.rating;
    comment.title = title || comment.title;
    comment.content = content || comment.content;
    comment.violationDetected = violationCheck.detected;
    comment.violationType = violationCheck.type;
    comment.status = violationCheck.detected ? 'rejected' : 'approved';
    comment.isApproved = !violationCheck.detected;

    await comment.save();

    res.status(200).json({
      success: true,
      message: 'Comment updated',
      comment
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const userId = req.userId;

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (comment.user.toString() !== userId) {
      return res.status(403).json({ message: 'Cannot delete others comment' });
    }

    await Comment.deleteOne({ _id: commentId });

    // Update product rating
    const allComments = await Comment.find({
      product: comment.product,
      isApproved: true
    });

    if (allComments.length > 0) {
      const avgRating = allComments.reduce((sum, c) => sum + c.rating, 0) / allComments.length;
      await Product.findByIdAndUpdate(
        comment.product,
        {
          ratingAverage: avgRating,
          ratingCount: allComments.length,
          commentCount: allComments.length
        }
      );
    } else {
      await Product.findByIdAndUpdate(
        comment.product,
        {
          ratingAverage: 0,
          ratingCount: 0,
          commentCount: 0
        }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Comment deleted'
    });
  } catch (error) {
    next(error);
  }
};

exports.markHelpful = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const { helpful } = req.body;

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (helpful) {
      comment.helpful += 1;
    } else {
      comment.notHelpful += 1;
    }

    await comment.save();

    res.status(200).json({
      success: true,
      message: 'Thank you for your feedback',
      comment
    });
  } catch (error) {
    next(error);
  }
};

// Admin functions
exports.getPendingComments = async (req, res, next) => {
  try {
    const comments = await Comment.find({ status: 'pending' })
      .populate('user', 'fullName email')
      .populate('product', 'name image')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: comments
    });
  } catch (error) {
    next(error);
  }
};

exports.approveComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findByIdAndUpdate(
      commentId,
      { status: 'approved', isApproved: true },
      { new: true }
    );

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Comment approved',
      comment
    });
  } catch (error) {
    next(error);
  }
};

exports.rejectComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findByIdAndUpdate(
      commentId,
      { status: 'rejected', isApproved: false },
      { new: true }
    );

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Comment rejected',
      comment
    });
  } catch (error) {
    next(error);
  }
};
