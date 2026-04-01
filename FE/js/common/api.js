// API Helper Functions
class ApiClient {
    constructor() {
        this.baseURL = window.CONFIG.API_BASE_URL;
    }

    getAuthHeaders() {
        const token = localStorage.getItem(window.CONFIG.STORAGE_KEYS.AUTH_TOKEN);
        return {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        };
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = this.getAuthHeaders();

        try {
            const response = await fetch(url, {
                ...options,
                headers: { ...headers, ...options.headers }
            });

            const data = await response.json();

            if (!response.ok) {
                // Handle 401 - Token expired
                if (response.status === 401) {
                    const refreshToken = localStorage.getItem(window.CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
                    if (refreshToken) {
                        await this.refreshAccessToken(refreshToken);
                        // Retry request
                        return this.request(endpoint, options);
                    } else {
                        this.redirectToLogin();
                    }
                }
                throw new Error(data.message || `API Error: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    async post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    async put(endpoint, body) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    }

    async patch(endpoint, body) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(body)
        });
    }

    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    async postFormData(endpoint, formData) {
        const url = `${this.baseURL}${endpoint}`;
        const token = localStorage.getItem(window.CONFIG.STORAGE_KEYS.AUTH_TOKEN);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `API Error: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async refreshAccessToken(refreshToken) {
        try {
            const response = await this.post('/auth/refresh-token', { refreshToken });
            localStorage.setItem(window.CONFIG.STORAGE_KEYS.AUTH_TOKEN, response.accessToken);
            localStorage.setItem(window.CONFIG.STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
            return response;
        } catch (error) {
            this.redirectToLogin();
        }
    }

    redirectToLogin() {
        localStorage.removeItem(window.CONFIG.STORAGE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(window.CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
        localStorage.removeItem(window.CONFIG.STORAGE_KEYS.USER_INFO);
        window.location.href = '/pages/auth/login.html';
    }

    setAuthToken(accessToken, refreshToken) {
        localStorage.setItem(window.CONFIG.STORAGE_KEYS.AUTH_TOKEN, accessToken);
        localStorage.setItem(window.CONFIG.STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    }

    getAuthToken() {
        return localStorage.getItem(window.CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    }

    isAuthenticated() {
        return !!this.getAuthToken();
    }

    logout() {
        localStorage.removeItem(window.CONFIG.STORAGE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(window.CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
        localStorage.removeItem(window.CONFIG.STORAGE_KEYS.USER_INFO);
        localStorage.removeItem(window.CONFIG.STORAGE_KEYS.CART);
    }
}

// Create global instance
window.apiClient = new ApiClient();

// Auth APIs
window.AuthAPI = {
    register: (data) => window.apiClient.post('/auth/register', data),
    login: (data) => window.apiClient.post('/auth/login', data),
    logout: () => window.apiClient.post('/auth/logout', {}),
    getProfile: () => window.apiClient.get('/auth/profile'),
    updateProfile: (data) => window.apiClient.put('/auth/profile', data),
    googleCallback: (data) => window.apiClient.post('/auth/google-callback', data),
    facebookCallback: (data) => window.apiClient.post('/auth/facebook-callback', data)
};

// Product APIs
window.ProductAPI = {
    getProducts: (params) => window.apiClient.get(`/products?${new URLSearchParams(params).toString()}`),
    getProduct: (slug) => window.apiClient.get(`/products/${slug}`),
    getFeaturedProducts: (limit = 10) => window.apiClient.get(`/products/featured?limit=${limit}`),
    getTopRatedProducts: (limit = 10) => window.apiClient.get(`/products/top-rated?limit=${limit}`),
    createProduct: (data) => window.apiClient.post('/products', data),
    updateProduct: (id, data) => window.apiClient.put(`/products/${id}`, data),
    deleteProduct: (id) => window.apiClient.delete(`/products/${id}`)
};

// Category APIs
window.CategoryAPI = {
    getCategories: () => window.apiClient.get('/categories'),
    getCategory: (slug) => window.apiClient.get(`/categories/${slug}`),
    createCategory: (data) => window.apiClient.post('/categories', data),
    updateCategory: (id, data) => window.apiClient.put(`/categories/${id}`, data),
    deleteCategory: (id) => window.apiClient.delete(`/categories/${id}`)
};

// Cart APIs
window.CartAPI = {
    getCart: () => window.apiClient.get('/carts'),
    addToCart: (data) => window.apiClient.post('/carts/add', data),
    updateCart: (data) => window.apiClient.put('/carts/update', data),
    removeFromCart: (productId, size, color) => 
        window.apiClient.delete(`/carts/remove/${productId}/${size}/${color}`),
    clearCart: () => window.apiClient.delete('/carts/clear')
};

// Order APIs
window.OrderAPI = {
    createOrder: (data) => window.apiClient.post('/orders', data),
    getOrders: (params) => window.apiClient.get(`/orders?${new URLSearchParams(params).toString()}`),
    getOrder: (orderId) => window.apiClient.get(`/orders/${orderId}`),
    cancelOrder: (orderId, reason) => window.apiClient.patch(`/orders/${orderId}/cancel`, { cancelReason: reason })
};

// Payment APIs
window.PaymentAPI = {
    processVNPay: (data) => window.apiClient.post('/payments/vnpay', data),
    processMoMo: (data) => window.apiClient.post('/payments/momo', data),
    processVietQR: (data) => window.apiClient.post('/payments/vietqr', data),
    getPaymentStatus: (paymentId) => window.apiClient.get(`/payments/${paymentId}/status`)
};

// Comment APIs
window.CommentAPI = {
    createComment: (data) => window.apiClient.post('/comments', data),
    getProductComments: (productId, params) => 
        window.apiClient.get(`/comments/product/${productId}?${new URLSearchParams(params).toString()}`),
    updateComment: (commentId, data) => window.apiClient.put(`/comments/${commentId}`, data),
    deleteComment: (commentId) => window.apiClient.delete(`/comments/${commentId}`),
    markHelpful: (commentId, helpful) => window.apiClient.post(`/comments/${commentId}/helpful`, { helpful })
};

// Chat APIs
window.ChatAPI = {
    getConversations: () => window.apiClient.get('/chats/conversations'),
    getMessages: (conversationId, params) => 
        window.apiClient.get(`/chats/${conversationId}/messages?${new URLSearchParams(params).toString()}`),
    sendMessage: (conversationId, data) => 
        window.apiClient.post(`/chats/${conversationId}/send`, data),
    markAsRead: (messageId) => window.apiClient.patch(`/chats/${messageId}/read`, {}),
    getUnreadCount: () => window.apiClient.get('/chats/unread/count')
};

// Dashboard APIs
window.DashboardAPI = {
    getStats: () => window.apiClient.get('/dashboard/stats'),
    getRevenueByMonth: (year) => window.apiClient.get(`/dashboard/revenue/monthly?year=${year}`),
    getRevenueByYear: (startYear, endYear) => 
        window.apiClient.get(`/dashboard/revenue/yearly?startYear=${startYear}&endYear=${endYear}`),
    getTopSellingProducts: (limit) => 
        window.apiClient.get(`/dashboard/products/top-selling?limit=${limit}`),
    getOrderStatusDistribution: () => 
        window.apiClient.get('/dashboard/orders/status-distribution'),
    getPaymentMethodDistribution: () => 
        window.apiClient.get('/dashboard/payments/method-distribution')
};

// User APIs
window.UserAPI = {
    getAllUsers: (params) => window.apiClient.get(`/users?${new URLSearchParams(params).toString()}`),
    getUserById: (userId) => window.apiClient.get(`/users/${userId}`),
    updateUserRole: (userId, role) => window.apiClient.patch(`/users/${userId}/role`, { role }),
    toggleUserStatus: (userId) => window.apiClient.patch(`/users/${userId}/status`, {})
};
