const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const EmailSender = require('../utils/emailSender');
const TokenManager = require('../utils/tokenManager');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
	validateLogin,
	validateRegister,
	validateProfileUpdate
} = require('../utils/validator');

router.post('/register', async (req, res, next) => {
	try {
		const { fullName, email, password, confirmPassword, phone } = req.body;
		const validation = validateRegister(fullName, email, password, confirmPassword, phone);

		if (!validation.isValid) {
			const message = Object.values(validation.errors).filter(Boolean).join('; ') || 'Validation failed';
			return res.status(400).json({ success: false, message, errors: validation.errors });
		}

		const existingUser = await authController.findUserByEmail(email);
		if (existingUser) {
			return res.status(400).json({ success: false, message: 'Email này đã được đăng ký' });
		}

		const user = await authController.createUser({
			fullName,
			email: String(email).toLowerCase(),
			password,
			phone,
			provider: 'local',
			role: 'user'
		});

		try {
			await EmailSender.sendWelcomeEmail(user.email, user.fullName);
		} catch (error) {
			console.error('Send welcome email error:', error.message);
		}

		const { accessToken, refreshToken, expiresIn } = TokenManager.generateTokenPair(user._id, user.role);
		user.refreshToken = refreshToken;
		await authController.saveUser(user);

		return res.status(201).json({
			success: true,
			message: 'Đăng ký thành công',
			user: user.toJSON(),
			accessToken,
			refreshToken,
			expiresIn
		});
	} catch (error) {
		next(error);
	}
});

router.post('/login', async (req, res, next) => {
	try {
		const { email, password } = req.body;
		const validation = validateLogin(email, password);

		if (!validation.isValid) {
			return res.status(400).json({
				success: false,
				message: 'Validation failed',
				errors: validation.errors
			});
		}

		const user = await authController.findUserByEmailWithPassword(email);
		if (!user) {
			return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác' });
		}

		if (!user.isActive) {
			return res.status(401).json({ success: false, message: 'Tài khoản này đã bị vô hiệu hóa' });
		}

		const isPasswordMatch = await user.comparePassword(password);
		if (!isPasswordMatch) {
			return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác' });
		}

		user.lastLogin = new Date();
		const { accessToken, refreshToken, expiresIn } = TokenManager.generateTokenPair(user._id, user.role);
		user.refreshToken = refreshToken;
		await authController.saveUser(user);

		return res.status(200).json({
			success: true,
			message: 'Đăng nhập thành công',
			user: user.toJSON(),
			accessToken,
			refreshToken,
			expiresIn
		});
	} catch (error) {
		next(error);
	}
});

router.post('/refresh-token', async (req, res) => {
	try {
		const { refreshToken } = req.body;
		if (!refreshToken) {
			return res.status(400).json({ success: false, message: 'Refresh token is required' });
		}

		const decoded = TokenManager.verifyRefreshToken(refreshToken);
		const user = await authController.findUserByRefreshToken(refreshToken);

		if (!user || String(user._id) !== String(decoded.userId)) {
			return res.status(401).json({ success: false, message: 'Invalid refresh token' });
		}

		const newTokens = TokenManager.generateTokenPair(user._id, user.role);
		user.refreshToken = newTokens.refreshToken;
		await authController.saveUser(user);

		return res.status(200).json({
			success: true,
			accessToken: newTokens.accessToken,
			refreshToken: newTokens.refreshToken,
			expiresIn: newTokens.expiresIn
		});
	} catch (error) {
		return res.status(401).json({ success: false, message: 'Invalid refresh token' });
	}
});

router.post('/logout', authenticate, async (req, res, next) => {
	try {
		req.user.refreshToken = null;
		await authController.saveUser(req.user);
		return res.status(200).json({ success: true, message: 'Logout successful' });
	} catch (error) {
		next(error);
	}
});

router.get('/profile', authenticate, async (req, res, next) => {
	try {
		const user = await authController.findUserById(req.userId);
		if (!user) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}

		return res.status(200).json({ success: true, user: user.toJSON() });
	} catch (error) {
		next(error);
	}
});

router.post('/profile/avatar', authenticate, upload.single('avatar'), async (req, res, next) => {
	try {
		const { buildUploadedFileUrl, deleteUploadFile } = require('../utils/uploadStorage');
		if (req.userRole === 'admin') {
			return res.status(403).json({ success: false, message: 'Tài khoản admin không chỉnh sửa hồ sơ tại đây' });
		}

		if (!req.file) {
			return res.status(400).json({ success: false, message: 'Vui lòng chọn ảnh đại diện hợp lệ' });
		}

		const previousAvatar = req.user?.avatar || null;
		const avatarPath = buildUploadedFileUrl(req.file);
		const user = await authController.updateUserProfile(req.userId, { avatar: avatarPath });

		if (!user) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}

		if (previousAvatar && previousAvatar !== avatarPath) {
			await deleteUploadFile(previousAvatar);
		}

		return res.status(200).json({
			success: true,
			message: 'Avatar updated successfully',
			avatar: avatarPath,
			user: user.toJSON()
		});
	} catch (error) {
		next(error);
	}
});

router.put('/profile', authenticate, async (req, res, next) => {
	try {
		if (req.userRole === 'admin') {
			return res.status(403).json({ success: false, message: 'Tài khoản admin không chỉnh sửa hồ sơ tại đây' });
		}

		const { fullName, phone, address, avatar } = req.body;
		const validation = validateProfileUpdate(fullName, phone, address);

		if (!validation.isValid) {
			return res.status(400).json({ success: false, message: 'Validation failed', errors: validation.errors });
		}

		const updateData = {};
		if (fullName !== undefined) updateData.fullName = fullName;
		if (phone !== undefined) updateData.phone = phone;
		if (address !== undefined) updateData.address = address;
		if (avatar !== undefined) updateData.avatar = avatar;

		const user = await authController.updateUserProfile(req.userId, updateData);
		if (!user) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}

		return res.status(200).json({
			success: true,
			message: 'Profile updated successfully',
			user: user.toJSON()
		});
	} catch (error) {
		next(error);
	}
});

router.post('/google-callback', (req, res) => {
	return res.status(501).json({ success: false, message: 'Google login chưa được triển khai' });
});

router.post('/facebook-callback', (req, res) => {
	return res.status(501).json({ success: false, message: 'Facebook login chưa được triển khai' });
});

module.exports = router;
