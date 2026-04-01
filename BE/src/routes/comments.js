const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const { authenticate, authorize } = require('../middleware/auth');

// Public routes
router.get('/product/:productId', commentController.getProductComments);

// Customer routes
router.post('/', authenticate, commentController.createComment);
router.put('/:id', authenticate, commentController.updateComment);
router.delete('/:id', authenticate, commentController.deleteComment);
router.post('/:id/helpful', authenticate, commentController.markHelpful);

// Admin routes
router.get('/admin/pending', authenticate, authorize('admin'), commentController.getPendingComments);
router.put('/:id/approve', authenticate, authorize('admin'), commentController.approveComment);
router.put('/:id/reject', authenticate, authorize('admin'), commentController.rejectComment);

module.exports = router;
