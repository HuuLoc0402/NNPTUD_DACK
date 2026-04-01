const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order is required']
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required']
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required']
    },
    paymentMethod: {
      type: String,
      enum: ['vnpay', 'momo', 'vietqr', 'cod'],
      required: true
    },
    transactionId: {
      type: String,
      unique: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded'],
      default: 'pending'
    },
    description: String,
    responseCode: String,
    responseMessage: String,
    paymentGatewayResponse: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String,
    completedAt: Date,
    failureReason: String
  },
  { timestamps: true }
);

// Create indexes
paymentSchema.index({ order: 1 });
paymentSchema.index({ user: 1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
