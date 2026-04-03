const express = require('express');
const ChatMessage = require('../models/ChatMessage');
const chatController = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const mapSenderRole = (role) => (role === 'admin' ? 'admin' : 'customer');

const canAccessConversation = (req, conversationId) => {
  return req.userRole === 'admin' || String(conversationId) === String(req.userId);
};

router.get('/conversations', authenticate, async (req, res, next) => {
  try {
    const match = req.userRole === 'admin'
      ? {}
      : { conversationId: String(req.userId) };

    const messages = await ChatMessage.find(match).sort({ createdAt: -1 }).populate('sender', 'fullName avatar role');
    const conversationMap = new Map();

    messages.forEach((message) => {
      const key = message.conversationId;
      if (!conversationMap.has(key)) {
        const unreadCount = messages.filter((item) =>
          item.conversationId === key
          && !item.isRead
          && String(item.sender?._id || item.sender) !== String(req.userId)
        ).length;

        conversationMap.set(key, {
          conversationId: key,
          lastMessage: message.message,
          updatedAt: message.createdAt,
          unreadCount,
          sender: message.sender,
          senderRole: message.senderRole
        });
      }
    });

    return res.status(200).json({ success: true, data: Array.from(conversationMap.values()) });
  } catch (error) {
    next(error);
  }
});

router.get('/unread/count', authenticate, async (req, res, next) => {
  try {
    const filter = req.userRole === 'admin'
      ? { isRead: false, senderRole: 'customer' }
      : { conversationId: String(req.userId), isRead: false, sender: { $ne: req.userId } };

    const count = await ChatMessage.countDocuments(filter);
    return res.status(200).json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
});

router.get('/:conversationId/messages', authenticate, async (req, res, next) => {
  try {
    const conversationId = canAccessConversation(req, req.params.conversationId)
      ? req.params.conversationId
      : String(req.userId);
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 50);
    const skip = (page - 1) * limit;
    const messages = await ChatMessage.find({ conversationId })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'fullName avatar role');

    return res.status(200).json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
});

router.post('/:conversationId/send', authenticate, async (req, res, next) => {
  try {
    const conversationId = req.userRole === 'admin'
      ? req.params.conversationId
      : String(req.userId);
    const messageText = String(req.body.message || '').trim();

    if (!messageText) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    const message = await chatController.createMessage({
      conversationId,
      sender: req.userId,
      senderName: req.user.fullName,
      senderAvatar: req.user.avatar,
      senderRole: mapSenderRole(req.userRole),
      message: messageText,
      messageType: req.body.messageType || 'text',
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments : []
    });

    const savedMessage = await chatController.findMessageById(message._id);
    if (req.io) {
      req.io.to(conversationId).emit('receive-message', savedMessage);
    }

    return res.status(201).json({ success: true, data: savedMessage });
  } catch (error) {
    next(error);
  }
});

router.patch('/:messageId/read', authenticate, async (req, res, next) => {
  try {
    const message = await chatController.findMessageById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (!canAccessConversation(req, message.conversationId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền cập nhật tin nhắn này' });
    }

    message.isRead = true;
    message.readAt = new Date();
    await message.save();

    return res.status(200).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
});

module.exports = router;