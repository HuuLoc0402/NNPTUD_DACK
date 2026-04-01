const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true
        },
        quantity: {
          type: Number,
          required: true,
          min: [1, 'Quantity cannot be less than 1']
        },
        selectedSize: String,
        selectedColor: String,
        price: Number,
        discount: Number,
        _id: false
      }
    ],
    totalItems: {
      type: Number,
      default: 0
    },
    totalPrice: {
      type: Number,
      default: 0
    },
    totalDiscount: {
      type: Number,
      default: 0
    },
    finalPrice: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// Calculate totals before saving
cartSchema.pre('save', function(next) {
  let totalItems = 0;
  let totalPrice = 0;
  let totalDiscount = 0;

  this.items.forEach(item => {
    totalItems += item.quantity;
    const itemTotalPrice = item.price * item.quantity;
    const itemDiscount = (item.price * item.discount / 100) * item.quantity;
    totalPrice += itemTotalPrice;
    totalDiscount += itemDiscount;
  });

  this.totalItems = totalItems;
  this.totalPrice = totalPrice;
  this.totalDiscount = totalDiscount;
  this.finalPrice = totalPrice - totalDiscount;

  next();
});

// Create index
cartSchema.index({ user: 1 });

module.exports = mongoose.model('Cart', cartSchema);
