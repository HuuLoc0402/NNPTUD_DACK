const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required']
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required']
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order ID is required for comment verification']
    },
    rating: {
      type: Number,
      default: null,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5']
    },
    title: {
      type: String,
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      maxlength: [2000, 'Comment cannot exceed 2000 characters']
    },
    images: [
      {
        url: String,
        _id: false
      }
    ],
    isVerified: {
      type: Boolean,
      default: false
    },
    violationDetected: {
      type: Boolean,
      default: false
    },
    violationType: {
      type: String,
      enum: ['none', 'profanity', 'spam', 'harassment', 'inappropriate', 'false_info'],
      default: 'none'
    },
    violationDetails: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    helpful: {
      type: Number,
      default: 0
    },
    notHelpful: {
      type: Number,
      default: 0
    },
    isApproved: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// Create indexes
commentSchema.index({ product: 1, createdAt: -1 });
commentSchema.index({ user: 1 });
commentSchema.index({ status: 1 });
commentSchema.index({ isApproved: 1 });

module.exports = mongoose.model('Comment', commentSchema);
