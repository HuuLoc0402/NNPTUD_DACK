const ChatMessage = require('../models/ChatMessage');

exports.createMessage = (payload) => {
  const message = new ChatMessage(payload);
  return message.save();
};

exports.findMessages = (filter = {}) => {
  return ChatMessage.find(filter)
    .populate('sender', 'fullName avatar role')
    .sort({ createdAt: -1 });
};

exports.findMessageById = (messageId) => {
  return ChatMessage.findById(messageId).populate('sender', 'fullName avatar role');
};

exports.updateMessage = (messageId, updateData) => {
  return ChatMessage.findByIdAndUpdate(messageId, updateData, {
    new: true,
    runValidators: true
  }).populate('sender', 'fullName avatar role');
};

exports.findConversationMessages = (conversationId) => {
  return ChatMessage.find({ conversationId })
    .populate('sender', 'fullName avatar role')
    .sort({ createdAt: 1 });
};

exports.findUnreadMessages = (filter = {}) => {
  return ChatMessage.find({ ...filter, isRead: false });
};