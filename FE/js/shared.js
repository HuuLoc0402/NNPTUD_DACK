function getStorageKey(name, fallbackValue) {
    return window.CONFIG?.STORAGE_KEYS?.[name] || fallbackValue;
}

function getStoredUser() {
    const rawUser = localStorage.getItem(getStorageKey('USER_INFO', 'marc_user_info')) || localStorage.getItem('userInfo');
    if (!rawUser) {
        return null;
    }

    try {
        return JSON.parse(rawUser);
    } catch (error) {
        console.error('Invalid user info in storage:', error);
        return null;
    }
}

function getStoredCart() {
    const rawCart = localStorage.getItem(getStorageKey('CART', 'marc_cart')) || localStorage.getItem('cart');
    if (!rawCart) {
        return [];
    }

    try {
        const parsed = JSON.parse(rawCart);
        if (Array.isArray(parsed)) {
            return parsed;
        }
        return Array.isArray(parsed.items) ? parsed.items : [];
    } catch (error) {
        console.error('Invalid cart data in storage:', error);
        return [];
    }
}

function updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    if (!badge) {
        return;
    }

    const items = getStoredCart();
    const total = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    badge.textContent = String(total);
    badge.style.display = total > 0 ? 'inline-flex' : 'none';
}

function updateHeaderAuth() {
    const authContainer = document.getElementById('auth-buttons');
    if (!authContainer) {
        return;
    }

    const user = getStoredUser();
    if (!user) {
        authContainer.innerHTML = '<a href="../auth/login.html" class="header-auth" style="color: var(--primary-color); font-weight: 600;">Đăng nhập</a>';
        return;
    }

    authContainer.innerHTML = `<span class="header-user">${user.fullName || 'Tài khoản'}</span><button id="logoutBtn" class="header-logout-btn">Đăng xuất</button>`;
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

function clearAuthStorage() {
    if (window.apiClient?.logout) {
        window.apiClient.logout();
        return;
    }

    localStorage.removeItem(getStorageKey('AUTH_TOKEN', 'marc_auth_token'));
    localStorage.removeItem(getStorageKey('REFRESH_TOKEN', 'marc_refresh_token'));
    localStorage.removeItem(getStorageKey('USER_INFO', 'marc_user_info'));
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
}

function redirectToLogin() {
    window.location.replace('../auth/login.html');
}

async function logout(event) {
    if (event) {
        event.preventDefault();
    }

    try {
        if (window.AuthAPI?.logout && window.apiClient?.isAuthenticated()) {
            await window.AuthAPI.logout();
        }
    } catch (error) {
        console.warn('Logout request failed:', error);
    }

    clearAuthStorage();
    updateHeaderAuth();
    redirectToLogin();
}

window.addEventListener('pageshow', function() {
    updateCartBadge();
    updateHeaderAuth();
});

window.updateCartBadge = updateCartBadge;
window.updateHeaderAuth = updateHeaderAuth;
window.clearAuthStorage = clearAuthStorage;
window.logout = logout;
