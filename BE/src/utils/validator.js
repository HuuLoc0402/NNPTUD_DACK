

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  return password && password.length >= 6;
};

const validateFullName = (fullName) => {
  return fullName && fullName.trim().length >= 2;
};

const validatePhone = (phone) => {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s\-\+]/g, '');
  // Accept 10-11 digits or Vietnam format starting with 0
  return /^[0-9]{10,11}$/.test(cleaned);
};

// Validate login credentials
exports.validateLogin = (email, password) => {
  const errors = {};

  if (!email) {
    errors.email = 'Email là bắt buộc';
  } else if (!validateEmail(email)) {
    errors.email = 'Email không hợp lệ';
  }

  if (!password) {
    errors.password = 'Mật khẩu là bắt buộc';
  } else if (!validatePassword(password)) {
    errors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Validate registration (for both user and admin)
exports.validateRegister = (fullName, email, password, confirmPassword, phone) => {
  const errors = {};

  if (!fullName) {
    errors.fullName = 'Tên đầy đủ là bắt buộc';
  } else if (!validateFullName(fullName)) {
    errors.fullName = 'Tên phải có ít nhất 2 ký tự';
  }

  if (!email) {
    errors.email = 'Email là bắt buộc';
  } else if (!validateEmail(email)) {
    errors.email = 'Email không hợp lệ';
  }

  if (!password) {
    errors.password = 'Mật khẩu là bắt buộc';
  } else if (!validatePassword(password)) {
    errors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Xác nhận mật khẩu là bắt buộc';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Mật khẩu không trùng khớp';
  }

  if (!phone) {
    errors.phone = 'Số điện thoại là bắt buộc';
  } else if (!validatePhone(phone)) {
    errors.phone = 'Số điện thoại phải có 10-11 số';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Validate profile update
exports.validateProfileUpdate = (fullName, phone, address) => {
  const errors = {};

  if (fullName && !validateFullName(fullName)) {
    errors.fullName = 'Tên phải có ít nhất 2 ký tự';
  }

  if (phone && !validatePhone(phone)) {
    errors.phone = 'Số điện thoại phải có 10-11 số';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

exports.validateForgotPasswordRequest = (email) => {
  const errors = {};

  if (!email) {
    errors.email = 'Email là bắt buộc';
  } else if (!validateEmail(email)) {
    errors.email = 'Email không hợp lệ';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

exports.validatePasswordReset = (password, confirmPassword) => {
  const errors = {};

  if (!password) {
    errors.password = 'Mật khẩu mới là bắt buộc';
  } else if (!validatePassword(password)) {
    errors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Xác nhận mật khẩu là bắt buộc';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Mật khẩu xác nhận không khớp';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

exports.validateChangePassword = (currentPassword, newPassword, confirmPassword) => {
  const errors = {};

  if (!currentPassword) {
    errors.currentPassword = 'Mật khẩu hiện tại là bắt buộc';
  }

  if (!newPassword) {
    errors.newPassword = 'Mật khẩu mới là bắt buộc';
  } else if (!validatePassword(newPassword)) {
    errors.newPassword = 'Mật khẩu mới phải có ít nhất 6 ký tự';
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Xác nhận mật khẩu là bắt buộc';
  } else if (newPassword !== confirmPassword) {
    errors.confirmPassword = 'Mật khẩu xác nhận không khớp';
  }

  if (currentPassword && newPassword && currentPassword === newPassword) {
    errors.newPassword = 'Mật khẩu mới phải khác mật khẩu hiện tại';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Validate user role update (admin only)
exports.validateRoleUpdate = (role) => {
  const validRoles = ['user', 'admin'];
  
  if (!validRoles.includes(role)) {
    return {
      isValid: false,
      errors: { role: 'Role phải là user hoặc admin' }
    };
  }

  return {
    isValid: true,
    errors: {}
  };
};
