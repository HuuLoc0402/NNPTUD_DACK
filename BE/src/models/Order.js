const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    orderCode: {
      type: String,
      unique: true,
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required']
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true
        },
        productName: String,
        productImage: String,
        quantity: {
          type: Number,
          required: true
        },
        selectedSize: String,
        selectedColor: String,
        price: Number,
        discount: Number,
        totalPrice: Number,
        _id: false
      }
    ],
    shippingAddress: {
      fullName: String,
      phone: String,
      email: String,
      street: String,
      ward: String,
      district: String,
      province: String,
      postalCode: String
    },
    totalItems: Number,
    subtotal: Number,
    shippingFee: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    },
    discount: {
      type: Number,
      default: 0
    },
    totalAmount: Number,
    paymentMethod: {
      type: String,
      enum: ['vnpay', 'momo', 'vietqr', 'cod'],
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled'],
      default: 'pending'
    },
    orderStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipping', 'delivered', 'cancelled', 'returned'],
      default: 'pending'
    },
    transactionId: String,
    notes: String,
    trackingNumber: String,
    estimatedDelivery: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    cancelReason: String
  },
  { timestamps: true }
);

// Create order code before saving
orderSchema.pre('save', function(next) {
  if (!this.orderCode) {
    // Format: ORD + timestamp + random 4 digits
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.orderCode = `ORD${timestamp}${random}`;
  }
  next();
});

// Create indexes
orderSchema.index({ orderCode: 1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
