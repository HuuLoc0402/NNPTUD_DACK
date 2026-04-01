const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

// Admin routes only - require authenticate and admin authorization
router.get('/', authenticate, authorize('admin'), userController.getAllUsers);
router.get('/:id', authenticate, authorize('admin'), userController.getUserById);
router.put('/:id/role', authenticate, authorize('admin'), userController.updateUserRole);
router.put('/:id/status', authenticate, authorize('admin'), userController.toggleUserStatus);
router.delete('/:id', authenticate, authorize('admin'), userController.deleteUser);

module.exports = router;
