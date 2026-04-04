const mongoose = require('mongoose');

const collectionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Collection name is required'],
      unique: true,
      trim: true,
      maxlength: [150, 'Collection name cannot exceed 150 characters']
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true
    },
    description: {
      type: String,
      default: '',
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    image: {
      type: String,
      default: null
    },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    displayOrder: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

collectionSchema.index({ slug: 1 });
collectionSchema.index({ name: 1 });
collectionSchema.index({ isActive: 1, isFeatured: 1, displayOrder: 1 });

module.exports = mongoose.model('Collection', collectionSchema);