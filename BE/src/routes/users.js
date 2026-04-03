const express = require('express');
const userController = require('../controllers/userController');
const { authenticate, adminOnly } = require('../middleware/auth');
const { validateRoleUpdate } = require('../utils/validator');

const router = express.Router();

router.get('/', authenticate, adminOnly, async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.role) {
      filter.role = req.query.role;
    }

    if (req.query.status === 'active') {
      filter.isActive = true;
    }

    if (req.query.status === 'inactive') {
      filter.isActive = false;
    }

    const users = await userController.findUsers(filter);
    const search = String(req.query.search || '').trim().toLowerCase();
    const data = search
      ? users.filter((user) =>
          user.fullName?.toLowerCase().includes(search)
          || user.email?.toLowerCase().includes(search)
          || user.phone?.toLowerCase().includes(search)
        )
      : users;

    return res.status(200).json({ success: true, data: data.map((user) => user.toJSON()) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, adminOnly, async (req, res, next) => {
  try {
    const user = await userController.findUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({ success: true, data: user.toJSON() });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/role', authenticate, adminOnly, async (req, res, next) => {
  try {
    const validation = validateRoleUpdate(req.body.role);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, message: validation.errors.role, errors: validation.errors });
    }

    const user = await userController.updateUserRole(req.params.id, req.body.role);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({ success: true, data: user.toJSON() });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', authenticate, adminOnly, async (req, res, next) => {
  try {
    const user = await userController.toggleUserStatus(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({ success: true, data: user.toJSON() });
  } catch (error) {
    next(error);
  }
});

module.exports = router;