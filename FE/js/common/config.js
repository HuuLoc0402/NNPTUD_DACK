// API Configuration
const DEFAULT_LOCAL_ORIGIN = 'http://localhost:5000';

function resolveApiOrigin() {
    const { protocol, origin, hostname, port } = window.location;
    const isFileProtocol = protocol === 'file:';
    const isMissingOrigin = !origin || origin === 'null';
    const isLocalFrontendServer = ['localhost', '127.0.0.1'].includes(hostname) && port && port !== '5000';

    if (isFileProtocol || isMissingOrigin || isLocalFrontendServer) {
        return DEFAULT_LOCAL_ORIGIN;
    }

    return origin;
}

const API_ORIGIN = resolveApiOrigin();
const API_BASE_URL = `${API_ORIGIN}/api/v1`;
const SOCKET_URL = API_ORIGIN;

// Storage Keys
const STORAGE_KEYS = {
    AUTH_TOKEN: 'marc_auth_token',
    REFRESH_TOKEN: 'marc_refresh_token',
    USER_INFO: 'marc_user_info',
    CART: 'marc_cart',
    THEME: 'marc_theme'
};

// Payment Methods
const PAYMENT_METHODS = {
    VNPAY: 'vnpay',
    MOMO: 'momo',
    VIETQR: 'vietqr',
    COD: 'cod'
};

// Order Status
const ORDER_STATUS = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PROCESSING: 'processing',
    SHIPPING: 'shipping',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    RETURNED: 'returned'
};

// User Roles
const USER_ROLES = {
    CUSTOMER: 'customer',
    ADMIN: 'admin'
};

// Export
window.CONFIG = {
    API_BASE_URL,
    SOCKET_URL,
    STORAGE_KEYS,
    PAYMENT_METHODS,
    ORDER_STATUS,
    USER_ROLES
};
