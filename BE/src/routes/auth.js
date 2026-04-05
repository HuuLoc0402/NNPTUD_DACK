const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const authController = require('../controllers/authController');
const EmailSender = require('../utils/emailSender');
const TokenManager = require('../utils/tokenManager');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
	validateLogin,
	validateRegister,
	validateProfileUpdate,
	validateForgotPasswordRequest,
	validatePasswordReset,
	validateChangePassword
} = require('../utils/validator');

const buildClientOrigin = () => {
	const fallback = 'http://127.0.0.1:5500';
	const configured = String(process.env.CLIENT_URL || fallback).trim();

	try {
		const parsed = new URL(configured);
		return parsed.origin;
	} catch (error) {
		return fallback;
	}
};

const buildForgotPasswordPageUrl = (token) => {
	const clientOrigin = buildClientOrigin();
	const url = new URL('/FE/pages/auth/forgetpassword.html', clientOrigin);
	if (token) {
		url.searchParams.set('token', token);
	}
	return url.toString();
};

const generatePasswordResetToken = () => crypto.randomBytes(32).toString('hex');
const hashPasswordResetToken = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex');

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

router.post('/forgot-password', async (req, res, next) => {
	try {
		const { email } = req.body;
		const validation = validateForgotPasswordRequest(email);

		if (!validation.isValid) {
			return res.status(400).json({
				success: false,
				message: 'Validation failed',
				errors: validation.errors
			});
		}

		const user = await authController.findUserByEmail(email);
		if (user && user.provider === 'local' && user.isActive) {
			const resetToken = generatePasswordResetToken();
			user.passwordResetToken = hashPasswordResetToken(resetToken);
			user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
			await authController.saveUser(user);

			try {
				await EmailSender.sendPasswordReset(user.email, buildForgotPasswordPageUrl(resetToken), user.fullName);
			} catch (error) {
				console.error('Send password reset email error:', error.message);
			}
		}

		return res.status(200).json({
			success: true,
			message: 'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi liên kết đặt lại mật khẩu.'
		});
	} catch (error) {
		next(error);
	}
});

router.post('/reset-password', async (req, res, next) => {
	try {
		const { token, password, confirmPassword } = req.body;
		const validation = validatePasswordReset(password, confirmPassword);

		if (!token) {
			return res.status(400).json({ success: false, message: 'Token đặt lại mật khẩu không hợp lệ.' });
		}

		if (!validation.isValid) {
			return res.status(400).json({
				success: false,
				message: 'Validation failed',
				errors: validation.errors
			});
		}

		const hashedToken = hashPasswordResetToken(token);
		const user = await authController.findUserByPasswordResetToken(hashedToken);
		if (!user) {
			return res.status(400).json({ success: false, message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' });
		}

		user.password = password;
		user.passwordResetToken = null;
		user.passwordResetExpires = null;
		user.refreshToken = null;
		await authController.saveUser(user);

		return res.status(200).json({
			success: true,
			message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập lại ngay bây giờ.'
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

router.put('/change-password', authenticate, async (req, res, next) => {
	try {
		if (req.userRole === 'admin') {
			return res.status(403).json({ success: false, message: 'Tài khoản admin không đổi mật khẩu tại đây' });
		}

		const { currentPassword, newPassword, confirmPassword } = req.body;
		const validation = validateChangePassword(currentPassword, newPassword, confirmPassword);

		if (!validation.isValid) {
			return res.status(400).json({
				success: false,
				message: 'Validation failed',
				errors: validation.errors
			});
		}

		const user = await authController.findUserByIdWithPassword(req.userId);
		if (!user) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}

		const isPasswordMatch = await user.comparePassword(currentPassword);
		if (!isPasswordMatch) {
			return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác' });
		}

		user.password = newPassword;
		user.passwordResetToken = null;
		user.passwordResetExpires = null;
		const { accessToken, refreshToken, expiresIn } = TokenManager.generateTokenPair(user._id, user.role);
		user.refreshToken = refreshToken;
		await authController.saveUser(user);

		return res.status(200).json({
			success: true,
			message: 'Đổi mật khẩu thành công',
			user: user.toJSON(),
			accessToken,
			refreshToken,
			expiresIn
		});
	} catch (error) {
		next(error);
	}
});
module.exports = router;
