const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
      index: true
    },
    conversationType: {
      type: String,
      enum: ['admin'],
      default: 'admin',
      index: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender is required']
    },
    senderName: String,
    senderAvatar: String,
    senderRole: {
      type: String,
      enum: ['customer', 'admin'],
      required: true
    },
    message: {
      type: String,
      required: [true, 'Message content is required'],
      maxlength: [5000, 'Message cannot exceed 5000 characters']
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'file', 'notification', 'system'],
      default: 'text'
    },
    attachments: [
      {
        url: String,
        type: String,
        name: String,
        _id: false
      }
    ],
    isRead: {
      type: Boolean,
      default: false
    },
    readAt: Date,
    violationDetected: {
      type: Boolean,
      default: false
    },
    violationType: {
      type: String,
      enum: ['none', 'profanity', 'spam', 'harassment'],
      default: 'none'
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'failed'],
      default: 'sent'
    }
  },
  { timestamps: true }
);

// Create indexes
chatMessageSchema.index({ conversationId: 1, conversationType: 1, createdAt: -1 });
chatMessageSchema.index({ sender: 1 });
chatMessageSchema.index({ isRead: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
