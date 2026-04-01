const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Product name cannot exceed 200 characters']
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      maxlength: [3000, 'Description cannot exceed 3000 characters']
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required']
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative']
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100'],
      validate: {
        validator: function(v) {
          return v >= 0 && v <= 100;
        },
        message: 'Discount must be between 0 and 100'
      }
    },
    finalPrice: {
      type: Number,
      default: function() {
        return this.price * (1 - this.discount / 100);
      }
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      default: 0
    },
    image: {
      type: String,
      required: [true, 'Product image is required']
    },
    images: [
      {
        url: String,
        _id: false
      }
    ],
    // Product variants for different sizes with different prices
    variants: [
      {
        size: {
          type: String,
          required: true,
          enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'One Size']
        },
        price: {
          type: Number,
          required: true,
          min: [0, 'Price cannot be negative']
        },
        stock: {
          type: Number,
          default: 0,
          min: [0, 'Stock cannot be negative']
        },
        sku: {
          type: String,
          unique: true,
          sparse: true,
          trim: true
        },
        _id: false
      }
    ],
    color: [String],
    material: String,
    origin: String,
    brand: String,
    ratingAverage: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be less than 0'],
      max: [5, 'Rating cannot be more than 5']
    },
    ratingCount: {
      type: Number,
      default: 0
    },
    commentCount: {
      type: Number,
      default: 0
    },
    views: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isFeatured: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// Calculate final price before saving
productSchema.pre('save', function(next) {
  this.finalPrice = this.price * (1 - this.discount / 100);
  next();
});

// Create indexes
productSchema.index({ slug: 1 });
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ ratingAverage: -1 });
productSchema.index({ views: -1 });

module.exports = mongoose.model('Product', productSchema);
