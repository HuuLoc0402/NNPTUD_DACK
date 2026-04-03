const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    size: {
      type: String,
      trim: true,
      default: 'M'
    },
    color: {
      type: String,
      trim: true,
      default: 'Mac dinh'
    },
    nameSnapshot: {
      type: String,
      trim: true,
      default: ''
    },
    slugSnapshot: {
      type: String,
      trim: true,
      default: ''
    },
    imageSnapshot: {
      type: String,
      trim: true,
      default: ''
    },
    priceSnapshot: {
      type: Number,
      default: 0,
      min: 0
    },
    originalPriceSnapshot: {
      type: Number,
      default: 0,
      min: 0
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: false
  }
);

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    items: {
      type: [wishlistItemSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Wishlist', wishlistSchema);