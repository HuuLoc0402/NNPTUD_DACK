class ApiClient {
    constructor() {
        this.baseURL = window.CONFIG.API_BASE_URL;
    }

    getAuthHeaders(includeJson = true) {
        const token = localStorage.getItem(window.CONFIG.STORAGE_KEYS.AUTH_TOKEN)
            || localStorage.getItem('authToken');

        return {
            ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        };
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const includeJson = !(options.body instanceof FormData);
        const headers = {
            ...this.getAuthHeaders(includeJson),
            ...(options.headers || {})
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        let data = null;
        try {
            data = await response.json();
        } catch (error) {
            data = null;
        }

        if (!response.ok) {
            throw new Error(data?.message || `API Error: ${response.status}`);
        }

        return data;
    }

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    put(endpoint, body) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    }

    patch(endpoint, body) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(body)
        });
    }

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    postFormData(endpoint, formData) {
        return this.request(endpoint, {
            method: 'POST',
            body: formData
        });
    }

    putFormData(endpoint, formData) {
        return this.request(endpoint, {
            method: 'PUT',
            body: formData
        });
    }

    logout() {
        localStorage.removeItem(window.CONFIG.STORAGE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(window.CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
        localStorage.removeItem(window.CONFIG.STORAGE_KEYS.USER_INFO);
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('user');
        localStorage.removeItem('token');
    }

    isAuthenticated() {
        return !!(localStorage.getItem(window.CONFIG.STORAGE_KEYS.AUTH_TOKEN) || localStorage.getItem('authToken'));
    }
}

window.apiClient = new ApiClient();

window.AuthAPI = {
    register: (data) => window.apiClient.post('/auth/register', data),
    login: (data) => window.apiClient.post('/auth/login', data),
    logout: () => window.apiClient.post('/auth/logout', {}),
    getProfile: () => window.apiClient.get('/auth/profile')
};

window.ProductAPI = {
    getProducts: (params = {}) => window.apiClient.get(`/products?${new URLSearchParams(params).toString()}`),
    getProduct: (slug) => window.apiClient.get(`/products/${slug}`),
    getFeaturedProducts: (limit = 10) => window.apiClient.get(`/products/featured?limit=${limit}`),
    getTopRatedProducts: (limit = 10) => window.apiClient.get(`/products/top-rated?limit=${limit}`),
    createProductForm: (formData) => window.apiClient.postFormData('/products', formData),
    updateProductForm: (id, formData) => window.apiClient.putFormData(`/products/${id}`, formData),
    deleteProduct: (id) => window.apiClient.delete(`/products/${id}`)
};

window.CategoryAPI = {
    getCategories: () => window.apiClient.get('/categories'),
    getCategory: (idOrSlug) => window.apiClient.get(`/categories/${idOrSlug}`),
    createCategoryForm: (formData) => window.apiClient.postFormData('/categories', formData),
    updateCategoryForm: (id, formData) => window.apiClient.putFormData(`/categories/${id}`, formData),
    deleteCategory: (id) => window.apiClient.delete(`/categories/${id}`)
};

window.CartAPI = {
    getCart: () => window.apiClient.get('/carts'),
    addToCart: (data) => window.apiClient.post('/carts/add', data),
    updateCart: (data) => window.apiClient.put('/carts/update', data),
    clearCart: () => window.apiClient.delete('/carts/clear')
};

window.CommentAPI = {
    getComments: (productId, params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return window.apiClient.get(`/comments/product/${productId}${queryString ? `?${queryString}` : ''}`);
    },
    getEligibility: (productId) => window.apiClient.get(`/comments/product/${productId}/eligibility`),
    createComment: (data) => window.apiClient.post('/comments', data)
};

window.SizeAPI = {
    getSizes: () => window.apiClient.get('/sizes'),
    getSizeChart: (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return window.apiClient.get(`/sizes/chart${queryString ? `?${queryString}` : ''}`);
    },
    createSize: (data) => window.apiClient.post('/sizes', data),
    updateSize: (id, data) => window.apiClient.put(`/sizes/${id}`, data),
    deleteSize: (id) => window.apiClient.delete(`/sizes/${id}`)
};
