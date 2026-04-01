const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');

// Protected routes
router.get('/conversations', authenticate, chatController.getConversations);
router.get('/messages/:conversationId', authenticate, chatController.getMessages);
router.post('/messages', authenticate, chatController.sendMessage);

router.put('/messages/:messageId/read', authenticate, chatController.markAsRead);
router.put('/conversations/:conversationId/read', authenticate, chatController.markConversationAsRead);

router.get('/unread-count', authenticate, chatController.getUnreadCount);
router.delete('/messages/:messageId', authenticate, chatController.deleteMessage);
router.get('/search', authenticate, chatController.searchMessages);

module.exports = router;
