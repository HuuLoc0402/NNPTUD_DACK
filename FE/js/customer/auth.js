function showError(message) {
    const errorBox = document.getElementById('errorMessage');
    if (!errorBox) {
        alert(message);
        return;
    }

    errorBox.textContent = message;
    errorBox.style.display = 'block';
}

function clearError() {
    const errorBox = document.getElementById('errorMessage');
    if (!errorBox) {
        return;
    }

    errorBox.textContent = '';
    errorBox.style.display = 'none';
}

function getAuthResponsePayload(response) {
    if (!response || typeof response !== 'object') {
        return {};
    }

    if (response.data && typeof response.data === 'object' && (response.data.accessToken || response.data.user || response.data.refreshToken)) {
        return response.data;
    }

    return response;
}

function persistAuth(data) {
    const payload = getAuthResponsePayload(data);

    if (payload.accessToken) {
        localStorage.setItem(window.CONFIG.STORAGE_KEYS.AUTH_TOKEN, payload.accessToken);
        localStorage.setItem('authToken', payload.accessToken);
    }
    if (payload.refreshToken) {
        localStorage.setItem(window.CONFIG.STORAGE_KEYS.REFRESH_TOKEN, payload.refreshToken);
        localStorage.setItem('refreshToken', payload.refreshToken);
    }
    if (payload.user) {
        const serializedUser = JSON.stringify(payload.user);
        localStorage.setItem(window.CONFIG.STORAGE_KEYS.USER_INFO, serializedUser);
        localStorage.setItem('userInfo', serializedUser);
        localStorage.setItem('user', serializedUser);
    }
}

function redirectAfterAuth(data) {
    const payload = getAuthResponsePayload(data);
    const redirectParams = new URLSearchParams(window.location.search);
    const requestedRedirect = redirectParams.get('redirect') || sessionStorage.getItem('marc_post_auth_redirect');
    sessionStorage.removeItem('marc_post_auth_redirect');

    if (payload.user?.role === 'admin') {
        window.location.replace('../admin/dashboard.html');
        return;
    }

    if (requestedRedirect) {
        window.location.replace(requestedRedirect);
        return;
    }

    window.location.replace('../customer/index.html');
}

async function handleLoginSubmit(event) {
    event.preventDefault();
    clearError();

    try {
        const payload = {
            email: document.getElementById('email').value.trim(),
            password: document.getElementById('password').value
        };

        const result = await window.AuthAPI.login(payload);
        persistAuth(result);
        redirectAfterAuth(result);
    } catch (error) {
        showError(error.message || 'Đăng nhập thất bại');
    }
}

async function handleRegisterSubmit(event) {
    event.preventDefault();
    clearError();

    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const fullNameInput = document.getElementById('fullName') || document.getElementById('fullname');

    if (password !== confirmPassword) {
        showError('Mật khẩu xác nhận không khớp');
        return;
    }

    try {
        const payload = {
            fullName: fullNameInput?.value?.trim() || `${document.getElementById('firstName')?.value?.trim() || ''} ${document.getElementById('lastName')?.value?.trim() || ''}`.trim(),
            email: document.getElementById('email').value.trim(),
            password,
            confirmPassword,
            phone: document.getElementById('phone')?.value?.trim() || ''
        };

        const result = await window.AuthAPI.register(payload);
        persistAuth(result);
        redirectAfterAuth(result);
    } catch (error) {
        showError(error.message || 'Đăng ký thất bại');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }

    if (registerForm) {
        registerForm.addEventListener('submit', handleRegisterSubmit);
    }
});
