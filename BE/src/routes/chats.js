const express = require('express');
const ChatMessage = require('../models/ChatMessage');
const chatController = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');
const CommunityFilter = require('../utils/communityFilter');

const router = express.Router();

const mapSenderRole = (role) => (role === 'admin' ? 'admin' : 'customer');

const canAccessConversation = (req, conversationId) => {
  return req.userRole === 'admin' || String(conversationId) === String(req.userId);
};

const moderateMessage = (messageText) => {
  const analysis = CommunityFilter.analyzeContent(messageText);
  if (!analysis.detected) {
    return { detected: false, type: 'none', sanitizedMessage: messageText };
  }

  return {
    ...analysis,
    sanitizedMessage: CommunityFilter.sanitizeText(messageText)
  };
};

const buildModerationMessage = (type) => {
  switch (type) {
    case 'spam':
      return 'Tin nhắn bị chặn vì có dấu hiệu spam hoặc quảng cáo không phù hợp.';
    case 'harassment':
      return 'Tin nhắn bị chặn vì chứa nội dung công kích hoặc quấy rối.';
    default:
      return 'Tin nhắn bị chặn vì chứa từ ngữ không phù hợp với quy chuẩn cộng đồng.';
  }
};

const sendModerationResponse = (res, moderationResult) => {
  return res.status(400).json({
    success: false,
    code: 'COMMUNITY_VIOLATION',
    message: buildModerationMessage(moderationResult.type),
    data: {
      violationType: moderationResult.type,
      details: moderationResult.details,
      sanitizedMessage: moderationResult.sanitizedMessage
    }
  });
};

const buildMessagePayload = ({
  conversationId,
  conversationType,
  sender,
  senderName,
  senderAvatar,
  senderRole,
  message,
  messageType = 'text',
  attachments = [],
  isRead = false,
  readAt = null
}) => ({
  conversationId,
  conversationType,
  sender,
  senderName,
  senderAvatar,
  senderRole,
  message,
  messageType,
  attachments,
  isRead,
  readAt
});

const markConversationAsRead = async (conversationId, userId) => {
  await ChatMessage.updateMany(
    {
      conversationId,
      conversationType: 'admin',
      isRead: false,
      sender: { $ne: userId }
    },
    {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    }
  );
};

router.get('/conversations', authenticate, async (req, res, next) => {
  try {
    const match = req.userRole === 'admin'
      ? { conversationType: 'admin' }
      : { conversationId: String(req.userId), conversationType: 'admin' };

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
      ? { conversationType: 'admin', isRead: false, senderRole: 'customer' }
      : { conversationId: String(req.userId), conversationType: 'admin', isRead: false, sender: { $ne: req.userId } };

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
    const messages = await ChatMessage.find({ conversationId, conversationType: 'admin' })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'fullName avatar role');

    await markConversationAsRead(conversationId, req.userId);

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

    const moderationResult = moderateMessage(messageText);
    if (moderationResult.detected) {
      return sendModerationResponse(res, moderationResult);
    }

    const message = await chatController.createMessage(buildMessagePayload({
      conversationId,
      conversationType: 'admin',
      sender: req.userId,
      senderName: req.user.fullName,
      senderAvatar: req.user.avatar,
      senderRole: mapSenderRole(req.userRole),
      message: messageText,
      messageType: req.body.messageType || 'text',
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments : []
    }));

    const savedMessage = await chatController.findMessageById(message._id);
    if (req.io) {
      req.io.to(conversationId).emit('receive-message', savedMessage);
    }

    return res.status(201).json({ success: true, data: savedMessage });
  } catch (error) {
    next(error);
  }
});

router.patch('/:conversationId/read-all', authenticate, async (req, res, next) => {
  try {
    const conversationId = canAccessConversation(req, req.params.conversationId)
      ? req.params.conversationId
      : String(req.userId);

    await markConversationAsRead(conversationId, req.userId);
    return res.status(200).json({ success: true, data: { conversationId } });
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