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

function flattenMediaSources(input) {
    if (Array.isArray(input)) {
        return input.flatMap(flattenMediaSources);
    }

    if (!input) {
        return [];
    }

    if (typeof input === 'object') {
        return [input.url, input.src, input.image, input.path, input.filename].flatMap(flattenMediaSources);
    }

    const value = String(input).trim();
    return value ? [value] : [];
}

function normalizeMediaPath(value) {
    const source = String(value || '').trim().replace(/\\/g, '/');
    if (!source) {
        return null;
    }

    if (/^(https?:|data:|blob:)/i.test(source)) {
        return source;
    }

    if (/^\/uploads\//i.test(source)) {
        return `${SOCKET_URL}${source}`;
    }

    if (/^uploads\//i.test(source)) {
        return `${SOCKET_URL}/${source}`;
    }

    if (/^[^/?#]+\.(png|jpe?g|gif|webp|svg)$/i.test(source)) {
        return `${SOCKET_URL}/uploads/${source.replace(/^\/+/, '')}`;
    }

    return null;
}

function resolveMediaUrl(input, fallback = '') {
    const resolved = flattenMediaSources(input)
        .map(normalizeMediaPath)
        .find(Boolean);

    return resolved || fallback;
}

function resolveMediaUrls(input) {
    return Array.from(new Set(
        flattenMediaSources(input)
            .map(normalizeMediaPath)
            .filter(Boolean)
    ));
}

function resolveProductImage(product, fallback = '') {
    return resolveMediaUrl([
        product?.image,
        ...(Array.isArray(product?.images) ? product.images : [])
    ], fallback);
}

function resolveProductImages(product, fallback = '') {
    const urls = resolveMediaUrls([
        product?.image,
        ...(Array.isArray(product?.images) ? product.images : [])
    ]);

    if (urls.length > 0) {
        return urls;
    }

    return fallback ? [fallback] : [];
}

const STORAGE_KEYS = {
    AUTH_TOKEN: 'marc_auth_token',
    REFRESH_TOKEN: 'marc_refresh_token',
    USER_INFO: 'marc_user_info',
    CART: 'marc_cart',
    THEME: 'marc_theme'
};

window.CONFIG = {
    API_BASE_URL,
    SOCKET_URL,
    STORAGE_KEYS,
    resolveMediaUrl,
    resolveMediaUrls,
    resolveProductImage,
    resolveProductImages
};

window.API_BASE_URL = API_BASE_URL;
window.SOCKET_URL = SOCKET_URL;
