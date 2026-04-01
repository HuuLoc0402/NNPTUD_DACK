// Authentication JavaScript

const DEFAULT_CONFIG = {
    API_BASE_URL: 'http://localhost:5000/api/v1',
    STORAGE_KEYS: {
        AUTH_TOKEN: 'marc_auth_token',
        REFRESH_TOKEN: 'marc_refresh_token',
        USER_INFO: 'marc_user_info'
    }
};

document.addEventListener('DOMContentLoaded', () => {
    injectNotificationStyles();
    checkAuthStatus();

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
});

function getConfig() {
    return window.CONFIG || DEFAULT_CONFIG;
}

function getStorageKey(keyName, fallbackValue) {
    return getConfig().STORAGE_KEYS?.[keyName] || fallbackValue;
}

function getApiUrl(path) {
    return `${getConfig().API_BASE_URL}${path}`;
}

function getStoredToken() {
    return (
        localStorage.getItem(getStorageKey('AUTH_TOKEN', DEFAULT_CONFIG.STORAGE_KEYS.AUTH_TOKEN)) ||
        localStorage.getItem('authToken')
    );
}

function getStoredUser() {
    const rawUser =
        localStorage.getItem(getStorageKey('USER_INFO', DEFAULT_CONFIG.STORAGE_KEYS.USER_INFO)) ||
        localStorage.getItem('userInfo');

    if (!rawUser) {
        return null;
    }

    try {
        return JSON.parse(rawUser);
    } catch (error) {
        console.error('Invalid user data in storage:', error);
        return null;
    }
}

function persistAuthSession(data) {
    const authTokenKey = getStorageKey('AUTH_TOKEN', DEFAULT_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    const refreshTokenKey = getStorageKey('REFRESH_TOKEN', DEFAULT_CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
    const userInfoKey = getStorageKey('USER_INFO', DEFAULT_CONFIG.STORAGE_KEYS.USER_INFO);

    localStorage.setItem(authTokenKey, data.accessToken);
    localStorage.setItem(refreshTokenKey, data.refreshToken);
    localStorage.setItem(userInfoKey, JSON.stringify(data.user));

    // Keep backward compatibility with older scripts.
    localStorage.setItem('authToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('userInfo', JSON.stringify(data.user));
}

function clearInlineMessage() {
    const errorDiv = document.getElementById('errorMessage');

    if (!errorDiv) {
        return;
    }

    errorDiv.textContent = '';
    errorDiv.classList.remove('show');
    errorDiv.style.backgroundColor = '';
    errorDiv.style.color = '';
    errorDiv.style.borderColor = '';
}

function showInlineMessage(message, type = 'error') {
    const errorDiv = document.getElementById('errorMessage');

    if (!errorDiv) {
        showNotification(message, type);
        return;
    }

    const variants = {
        error: {
            background: '#f8d7da',
            color: '#721c24',
            border: '#f5c6cb'
        },
        success: {
            background: '#d4edda',
            color: '#155724',
            border: '#c3e6cb'
        },
        info: {
            background: '#d1ecf1',
            color: '#0c5460',
            border: '#bee5eb'
        }
    };

    const style = variants[type] || variants.info;
    errorDiv.textContent = message;
    errorDiv.style.backgroundColor = style.background;
    errorDiv.style.color = style.color;
    errorDiv.style.borderColor = style.border;
    errorDiv.classList.add('show');
}

function setButtonState(button, isLoading, loadingText, defaultText) {
    if (!button) {
        return;
    }

    button.disabled = isLoading;
    button.textContent = isLoading ? loadingText : defaultText;
}

function redirectByRole(role) {
    const target = role === 'admin' ? '../../pages/admin/dashboard.html' : '../customer/index.html';
    window.location.href = target;
}

function checkAuthStatus() {
    const isAuthPage = /(login|register)\.html$/i.test(window.location.pathname);

    if (!isAuthPage) {
        return;
    }

    const token = getStoredToken();
    const user = getStoredUser();

    if (token && user?.role) {
        redirectByRole(user.role);
    }
}

async function requestJson(path, options = {}) {
    const response = await fetch(getApiUrl(path), {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || 'Yeu cau that bai');
    }

    return data;
}

async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    const loginBtn = document.getElementById('loginBtn');
    let isSuccessful = false;

    clearInlineMessage();
    setButtonState(loginBtn, true, 'Đang xử lý...', 'Đăng Nhập');

    try {
        const data = await requestJson('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        persistAuthSession(data);
        showNotification('Đăng nhập thành công', 'success');
        isSuccessful = true;

        setTimeout(() => {
            redirectByRole(data.user?.role);
        }, 300);
    } catch (error) {
        console.error('Login error:', error);
        showInlineMessage(error.message || 'Đăng nhập thất bại', 'error');
    } finally {
        if (!isSuccessful) {
            setButtonState(loginBtn, false, 'Đang xử lý...', 'Đăng Nhập');
        }
    }
}

async function handleRegister(event) {
    event.preventDefault();

    const fullName =
        document.getElementById('fullName')?.value.trim() ||
        document.getElementById('fullname')?.value.trim() ||
        '';
    const email = document.getElementById('email')?.value.trim();
    const phone = document.getElementById('phone')?.value.trim();
    const password = document.getElementById('password')?.value;
    const confirmPassword =
        document.getElementById('confirmPassword')?.value ||
        document.getElementById('repeatPassword')?.value ||
        '';
    const registerButton = document.querySelector('#registerForm button[type="submit"]');
    let isSuccessful = false;

    clearInlineMessage();

    if (!fullName || !email || !phone || !password) {
        showInlineMessage('Vui lòng nhập đầy đủ thông tin', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showInlineMessage('Mật khẩu không khớp', 'error');
        return;
    }

    if (password.length < 6) {
        showInlineMessage('Mật khẩu phải có tối thiểu 6 ký tự', 'error');
        return;
    }

    setButtonState(registerButton, true, 'Đang xử lý...', 'Đăng Ký');

    try {
        await requestJson('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                fullName,
                email,
                phone,
                password
            })
        });

        showInlineMessage('Đăng ký thành công, vui lòng đăng nhập', 'success');
        isSuccessful = true;

        setTimeout(() => {
            window.location.href = 'login.html';
        }, 800);
    } catch (error) {
        console.error('Register error:', error);
        showInlineMessage(error.message || 'Đăng ký thất bại', 'error');
    } finally {
        if (!isSuccessful) {
            setButtonState(registerButton, false, 'Đang xử lý...', 'Đăng Ký');
        }
    }
}

async function handleGoogleLogin() {
    showNotification('Google Login chưa được triển khai', 'info');
}

async function handleFacebookLogin() {
    showNotification('Facebook Login chưa được triển khai', 'info');
}

async function handleGoogleRegister() {
    showNotification('Google Register chưa được triển khai', 'info');
}

async function handleFacebookRegister() {
    showNotification('Facebook Register chưa được triển khai', 'info');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="notification-icon fas fa-${getIcon(type)}"></i>
            <span>${message}</span>
        </div>
    `;

    document.body.appendChild(notification);

    requestAnimationFrame(() => {
        notification.classList.add('show');
    });

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function getIcon(type) {
    return {
        success: 'check-circle',
        error: 'exclamation-circle',
        info: 'info-circle',
        warning: 'triangle-exclamation'
    }[type] || 'info-circle';
}

function injectNotificationStyles() {
    if (document.getElementById('auth-notification-styles')) {
        return;
    }

    const notificationStyles = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 6px;
            background: white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 1000;
            opacity: 0;
            transform: translateX(400px);
            transition: all 0.3s ease;
        }

        .notification.show {
            opacity: 1;
            transform: translateX(0);
        }

        .notification-content {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .notification-success {
            border-left: 4px solid #28a745;
        }

        .notification-success .notification-icon {
            color: #28a745;
        }

        .notification-error {
            border-left: 4px solid #dc3545;
        }

        .notification-error .notification-icon {
            color: #dc3545;
        }

        .notification-info {
            border-left: 4px solid #17a2b8;
        }

        .notification-info .notification-icon {
            color: #17a2b8;
        }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.id = 'auth-notification-styles';
    styleSheet.textContent = notificationStyles;
    document.head.appendChild(styleSheet);
}

window.handleGoogleLogin = handleGoogleLogin;
window.handleFacebookLogin = handleFacebookLogin;
window.handleGoogleRegister = handleGoogleRegister;
window.handleFacebookRegister = handleFacebookRegister;
