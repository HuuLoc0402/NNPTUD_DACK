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

function storeUserInfo(user) {
    if (!user) {
        return;
    }

    localStorage.setItem(getStorageKey('USER_INFO', 'marc_user_info'), JSON.stringify(user));
    localStorage.setItem('userInfo', JSON.stringify(user));
}

const POST_AUTH_REDIRECT_KEY = 'marc_post_auth_redirect';

function getCurrentPathWithQuery() {
    return `${window.location.pathname || ''}${window.location.search || ''}${window.location.hash || ''}`;
}

function getCartOwnerScope(user = getStoredUser()) {
    return String(user?._id || user?.id || user?.email || user?.phone || '').trim();
}

function getUserCartStorageKey(user = getStoredUser()) {
    const baseKey = getStorageKey('CART', 'marc_cart');
    const ownerScope = getCartOwnerScope(user);
    return ownerScope ? `${baseKey}:${ownerScope}` : null;
}

function getUserInitials(user) {
    const name = String(user?.fullName || 'M').trim();
    const tokens = name.split(/\s+/).filter(Boolean);
    return tokens.slice(0, 2).map((token) => token.charAt(0).toUpperCase()).join('') || 'M';
}

function getUserAvatarMarkup(user) {
    const initials = getUserInitials(user);
    const avatarUrl = window.CONFIG?.resolveMediaUrl?.(user?.avatar, '') || '';
    if (avatarUrl) {
        return `<img src="${avatarUrl}" alt="${user?.fullName || 'Avatar'}" class="header-avatar-image" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='inline-flex';"><span class="header-avatar-fallback" style="display:none;">${initials}</span>`;
    }

    return `<span class="header-avatar-fallback">${initials}</span>`;
}

function getStoredCart() {
    const storageKey = getUserCartStorageKey();
    if (!storageKey) {
        return [];
    }

    const rawCart = localStorage.getItem(storageKey);
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

function persistStoredCart(items) {
    const storageKey = getUserCartStorageKey();
    if (!storageKey) {
        return false;
    }

    localStorage.setItem(storageKey, JSON.stringify(Array.isArray(items) ? items : []));
    updateCartBadge();
    return true;
}

function clearStoredCart() {
    const storageKey = getUserCartStorageKey();
    if (!storageKey) {
        return;
    }

    localStorage.removeItem(storageKey);
    updateCartBadge();
}

function getStoredWishlist() {
    const rawWishlist = localStorage.getItem(getStorageKey('WISHLIST', 'marc_wishlist')) || localStorage.getItem('wishlist');
    if (!rawWishlist) {
        return [];
    }

    try {
        const parsed = JSON.parse(rawWishlist);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Invalid wishlist data in storage:', error);
        return [];
    }
}

let wishlistSyncPromise = null;
let hasHydratedWishlistFromServer = false;

function persistWishlist(items) {
    localStorage.setItem(getStorageKey('WISHLIST', 'marc_wishlist'), JSON.stringify(items));
    localStorage.setItem('wishlist', JSON.stringify(items));
    updateWishlistBadge();
}

function canSyncWishlistWithServer() {
    return Boolean(window.apiClient?.isAuthenticated?.() && window.WishlistAPI);
}

async function syncWishlistFromServer(options = {}) {
    const { mergeLocal = false, force = false } = options;

    if (!canSyncWishlistWithServer()) {
        return getStoredWishlist();
    }

    if (wishlistSyncPromise && !force) {
        return wishlistSyncPromise;
    }

    wishlistSyncPromise = (async () => {
        const localItems = getStoredWishlist();

        if (mergeLocal && localItems.length) {
            await window.WishlistAPI.syncItems(localItems);
        }

        const response = await window.WishlistAPI.getMyWishlist();
        const serverItems = Array.isArray(response?.data) ? response.data : [];
        persistWishlist(serverItems);
        hasHydratedWishlistFromServer = true;
        return serverItems;
    })()
        .catch((error) => {
            console.error('Wishlist sync error:', error);
            return getStoredWishlist();
        })
        .finally(() => {
            wishlistSyncPromise = null;
        });

    return wishlistSyncPromise;
}

function updateWishlistBadge() {
    const badge = document.getElementById('wishlist-badge');
    if (!badge) {
        return;
    }

    const items = getStoredWishlist();
    badge.textContent = String(items.length);
    badge.style.display = items.length > 0 ? 'inline-flex' : 'none';
}

function normalizeWishlistItem(product) {
    return {
        productId: product.productId || product._id,
        slug: product.slug || product.productId || product._id,
        name: product.name || 'Sản phẩm',
        image: product.image || '',
        price: Number(product.price || 0),
        originalPrice: Number(product.originalPrice || product.price || 0),
        size: product.size || 'M',
        color: product.color || 'Mặc định',
        addedAt: product.addedAt || new Date().toISOString()
    };
}

function isProductWishlisted(productId) {
    return getStoredWishlist().some((item) => String(item.productId) === String(productId));
}

function toggleWishlistItem(product) {
    const normalizedItem = normalizeWishlistItem(product);
    const wishlist = getStoredWishlist();
    const previousWishlist = [...wishlist];
    const existingIndex = wishlist.findIndex((item) => String(item.productId) === String(normalizedItem.productId));

    if (existingIndex >= 0) {
        wishlist.splice(existingIndex, 1);
        persistWishlist(wishlist);
        if (canSyncWishlistWithServer()) {
            window.WishlistAPI.removeItem(normalizedItem.productId)
                .then((response) => {
                    if (Array.isArray(response?.data)) {
                        persistWishlist(response.data);
                    }
                })
                .catch((error) => {
                    console.error('Cannot remove wishlist item from server:', error);
                    persistWishlist(previousWishlist);
                });
        }
        return { active: false, items: wishlist };
    }

    wishlist.unshift(normalizedItem);
    persistWishlist(wishlist);
    if (canSyncWishlistWithServer()) {
        window.WishlistAPI.addItem(normalizedItem)
            .then((response) => {
                if (Array.isArray(response?.data)) {
                    persistWishlist(response.data);
                }
            })
            .catch((error) => {
                console.error('Cannot add wishlist item to server:', error);
                persistWishlist(previousWishlist);
            });
    }
    return { active: true, items: wishlist };
}

function removeWishlistItem(productId) {
    const previousWishlist = getStoredWishlist();
    const wishlist = previousWishlist.filter((item) => String(item.productId) !== String(productId));
    persistWishlist(wishlist);

    if (canSyncWishlistWithServer()) {
        window.WishlistAPI.removeItem(productId)
            .then((response) => {
                if (Array.isArray(response?.data)) {
                    persistWishlist(response.data);
                }
            })
            .catch((error) => {
                console.error('Cannot remove wishlist item from server:', error);
                persistWishlist(previousWishlist);
            });
    }

    return wishlist;
}

function clearWishlist() {
    const previousWishlist = getStoredWishlist();
    persistWishlist([]);

    if (canSyncWishlistWithServer()) {
        window.WishlistAPI.clearWishlist()
            .then(() => {
                persistWishlist([]);
            })
            .catch((error) => {
                console.error('Cannot clear wishlist on server:', error);
                persistWishlist(previousWishlist);
            });
    }
}

function setWishlistButtonState(button, isActive, options = {}) {
    if (!button) {
        return;
    }

    const icon = button.querySelector('i');
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');

    if (icon) {
        icon.classList.toggle('far', !isActive);
        icon.classList.toggle('fas', isActive);
    }

    if (options.textMode) {
        button.innerHTML = isActive
            ? '<i class="fas fa-heart"></i> Đã thêm yêu thích'
            : '<i class="far fa-heart"></i> Yêu thích';
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

function requireCustomerAuth(options = {}) {
    const { redirectPath = getCurrentPathWithQuery() } = options;
    const user = getStoredUser();

    if (!user) {
        redirectToLogin(redirectPath);
        return null;
    }

    if (user.role === 'admin') {
        window.location.replace('../admin/dashboard.html');
        return null;
    }

    return user;
}

function normalizeCartItem(product) {
    return {
        productId: product.productId || product._id,
        slug: product.slug || product.productId || product._id,
        name: product.name || 'Sản phẩm',
        price: Number(product.price || 0),
        image: product.image || '',
        quantity: Math.max(1, Number(product.quantity || 1) || 1),
        size: product.size || '',
        color: product.color || ''
    };
}

function addItemToCart(product, options = {}) {
    const user = requireCustomerAuth({ redirectPath: options.redirectPath || getCurrentPathWithQuery() });
    if (!user) {
        return { ok: false, requiresAuth: true };
    }

    const normalizedItem = normalizeCartItem(product);
    const cart = getStoredCart();
    const existingItem = cart.find((item) => String(item.productId) === String(normalizedItem.productId)
        && String(item.size || '') === String(normalizedItem.size || '')
        && String(item.color || '') === String(normalizedItem.color || ''));

    if (existingItem) {
        existingItem.quantity += normalizedItem.quantity;
        existingItem.price = normalizedItem.price || existingItem.price;
        existingItem.image = normalizedItem.image || existingItem.image;
        existingItem.slug = normalizedItem.slug || existingItem.slug;
        existingItem.name = normalizedItem.name || existingItem.name;
    } else {
        cart.push(normalizedItem);
    }

    persistStoredCart(cart);
    return { ok: true, items: cart, item: normalizedItem };
}

function updateHeaderAuth() {
    const authContainer = document.getElementById('auth-buttons');
    if (!authContainer) {
        return;
    }

    const user = getStoredUser();
    if (!user) {
        authContainer.innerHTML = '<a href="../auth/login.html" class="header-login-link">Đăng nhập</a>';
        return;
    }

    if (user.role === 'admin') {
        authContainer.innerHTML = `
            <div class="header-account">
                <button type="button" class="header-account-trigger" aria-label="Hồ sơ quản trị" title="Hồ sơ quản trị">
                    <span class="header-avatar">${getUserAvatarMarkup(user)}</span>
                </button>
                <div class="header-account-menu">
                    <a href="../admin/dashboard.html" class="header-account-link">Trang quản trị</a>
                </div>
            </div>
            <button id="logoutBtn" class="header-logout-btn header-logout-inline">Đăng xuất</button>
        `;
    } else {
        authContainer.innerHTML = `
            <div class="header-account">
                <button type="button" class="header-account-trigger" aria-label="Hồ sơ cá nhân" title="Hồ sơ cá nhân">
                    <span class="header-avatar">${getUserAvatarMarkup(user)}</span>
                </button>
                <div class="header-account-menu">
                    <a href="profile.html" class="header-account-link">Hồ sơ cá nhân</a>
                    <a href="order-history.html" class="header-account-link">Lịch sử đơn hàng</a>
                </div>
            </div>
            <button id="logoutBtn" class="header-logout-btn header-logout-inline">Đăng xuất</button>
        `;
    }

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
    localStorage.removeItem(getStorageKey('WISHLIST', 'marc_wishlist'));
    localStorage.removeItem('wishlist');
    hasHydratedWishlistFromServer = false;
}

function redirectToLogin(redirectPath = '') {
    const normalizedPath = String(redirectPath || getCurrentPathWithQuery()).trim();
    if (normalizedPath) {
        sessionStorage.setItem(POST_AUTH_REDIRECT_KEY, normalizedPath);
    }

    const loginUrl = normalizedPath
        ? `../auth/login.html?redirect=${encodeURIComponent(normalizedPath)}`
        : '../auth/login.html';

    window.location.replace(loginUrl);
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
    sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY);
    updateHeaderAuth();
    window.location.replace('../auth/login.html');
}

window.addEventListener('pageshow', function() {
    updateCartBadge();
    updateWishlistBadge();
    updateHeaderAuth();

    if (canSyncWishlistWithServer()) {
        syncWishlistFromServer({ mergeLocal: !hasHydratedWishlistFromServer });
    }
});

window.updateCartBadge = updateCartBadge;
window.getStoredWishlist = getStoredWishlist;
window.updateWishlistBadge = updateWishlistBadge;
window.isProductWishlisted = isProductWishlisted;
window.toggleWishlistItem = toggleWishlistItem;
window.removeWishlistItem = removeWishlistItem;
window.clearWishlist = clearWishlist;
window.setWishlistButtonState = setWishlistButtonState;
window.syncWishlistFromServer = syncWishlistFromServer;
window.getStoredUser = getStoredUser;
window.storeUserInfo = storeUserInfo;
window.updateHeaderAuth = updateHeaderAuth;
window.clearAuthStorage = clearAuthStorage;
window.logout = logout;
