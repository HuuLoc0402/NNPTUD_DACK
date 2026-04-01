const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const CommunityFilter = require('../utils/communityFilter');

exports.getConversations = async (req, res, next) => {
  try {
    const userId = req.userId;

    // Find all unique conversations this user is part of
    const messages = await ChatMessage.aggregate([
      {
        $match: {
          $or: [
            { sender: userId },
            { 'conversationId': { $regex: userId } }
          ]
        }
      },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $last: '$$ROOT' },
          messageCount: { $sum: 1 }
        }
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
      {
        $lookup: {
          from: 'users',
          let: { conversationId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ['$_id', { $split: ['$$conversationId', '-'] }]
                }
              }
            }
          ],
          as: 'otherUser'
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: messages
    });
  } catch (error) {
    next(error);
  }
};

exports.getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const messages = await ChatMessage.find({ conversationId })
      .populate('sender', 'fullName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ChatMessage.countDocuments({ conversationId });

    res.status(200).json({
      success: true,
      data: messages.reverse(), // Reverse to show chronologically
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { conversationId, message, messageType } = req.body;

    // Check for community violations
    const violationCheck = CommunityFilter.analyzeContent(message);

    const user = await User.findById(userId);

    const chatMessage = new ChatMessage({
      conversationId,
      sender: userId,
      senderName: user.fullName,
      senderAvatar: user.avatar,
      senderRole: user.role,
      message: violationCheck.detected ? CommunityFilter.sanitizeText(message) : message,
      messageType: messageType || 'text',
      violationDetected: violationCheck.detected,
      violationType: violationCheck.type,
      status: 'sent'
    });

    await chatMessage.save();
    await chatMessage.populate('sender', 'fullName avatar');

    // Emit via socket if available
    if (req.io) {
      req.io.to(conversationId).emit('new-message', {
        success: true,
        message: chatMessage,
        violationDetected: violationCheck.detected
      });
    }

    res.status(201).json({
      success: true,
      message: chatMessage,
      violationDetected: violationCheck.detected
    });
  } catch (error) {
    next(error);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const { messageId } = req.params;

    const message = await ChatMessage.findByIdAndUpdate(
      messageId,
      {
        isRead: true,
        readAt: new Date(),
        status: 'delivered'
      },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    res.status(200).json({
      success: true,
      message
    });
  } catch (error) {
    next(error);
  }
};

exports.markConversationAsRead = async (req, res, next) => {
  try {
    const { conversationId } = req.params;

    await ChatMessage.updateMany(
      { conversationId, isRead: false },
      {
        isRead: true,
        readAt: new Date(),
        status: 'delivered'
      }
    );

    res.status(200).json({
      success: true,
      message: 'Conversation marked as read'
    });
  } catch (error) {
    next(error);
  }
};

exports.getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.userId;

    const unreadCount = await ChatMessage.countDocuments({
      conversationId: { $regex: userId },
      isRead: false,
      sender: { $ne: userId }
    });

    res.status(200).json({
      success: true,
      unreadCount
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    const message = await ChatMessage.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.sender.toString() !== userId) {
      return res.status(403).json({ message: 'Cannot delete others message' });
    }

    await ChatMessage.deleteOne({ _id: messageId });

    res.status(200).json({
      success: true,
      message: 'Message deleted'
    });
  } catch (error) {
    next(error);
  }
};

exports.searchMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { keyword } = req.query;

    const messages = await ChatMessage.find({
      conversationId,
      message: { $regex: keyword, $options: 'i' }
    })
      .populate('sender', 'fullName avatar')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: messages
    });
  } catch (error) {
    next(error);
  }
};
