// Home Page Script

document.addEventListener('DOMContentLoaded', async () => {
    await initializePage();
    setupEventListeners();
});

async function initializePage() {
    try {
        // Load categories
        await loadCategories();
        
        // Load featured products
        await loadFeaturedProducts();
        
        // Load top rated products
        await loadTopRatedProducts();
        
        // Check user authentication
        updateUserMenu();
        
        // Update cart count
        updateCartCount();
    } catch (error) {
        console.error('Error initializing page:', error);
    }
}

async function loadCategories() {
    try {
        const data = await window.CategoryAPI.getCategories();
        const grid = document.getElementById('categoriesGrid');
        
        if (!grid) return;
        
        grid.innerHTML = data.data.map(category => `
            <div class="category-card" onclick="navigateToProducts('${category._id}')">
                ${category.image ? `<img src="${category.image}" alt="${category.name}">` : '<div style="height: 200px; background: #eee; display: flex; align-items: center; justify-content: center;"><i class="fas fa-image" style="font-size: 3rem; color: #ccc;"></i></div>'}
                <div class="category-card-content">
                    <h3>${category.name}</h3>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

async function loadFeaturedProducts() {
    try {
        const data = await window.ProductAPI.getFeaturedProducts(12);
        const grid = document.getElementById('featuredProducts');
        
        if (!grid) return;
        
        grid.innerHTML = data.data.map(product => createProductCardHTML(product)).join('');
    } catch (error) {
        console.error('Error loading featured products:', error);
    }
}

async function loadTopRatedProducts() {
    try {
        const data = await window.ProductAPI.getTopRatedProducts(12);
        const grid = document.getElementById('topRatedProducts');
        
        if (!grid) return;
        
        grid.innerHTML = data.data.map(product => createProductCardHTML(product)).join('');
    } catch (error) {
        console.error('Error loading top rated products:', error);
    }
}

function createProductCardHTML(product) {
    const discountPercent = product.discount ? Math.round(product.discount) : 0;
    const rating = product.ratingAverage || 0;
    const stars = '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
    
    return `
        <div class="product-card" onclick="navigateToProduct('${product.slug}')">
            <div class="product-image">
                <img src="${product.image}" alt="${product.name}">
                ${discountPercent > 0 ? `<span class="product-badge">-${discountPercent}%</span>` : ''}
            </div>
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-price">
                    <div>
                        <span class="price">$${product.finalPrice.toFixed(0)}</span>
                        ${product.discount > 0 ? `<span class="original-price">$${product.price.toFixed(0)}</span>` : ''}
                    </div>
                </div>
                ${product.ratingCount > 0 ? `
                    <div class="product-rating">
                        <span class="stars">${stars}</span>
                        <span>(${product.ratingCount})</span>
                    </div>
                ` : ''}
                <button class="add-to-cart-btn" onclick="addToCart(event, '${product._id}')">
                    <i class="fas fa-shopping-cart"></i> Thêm
                </button>
            </div>
        </div>
    `;
}

function setupEventListeners() {
    // Search
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    
    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => searchProducts());
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchProducts();
        });
    }
    
    // Cart
    const cartAction = document.querySelector('.cart-action');
    if (cartAction) {
        cartAction.addEventListener('click', () => window.location.href = 'cart.html');
    }
    
    // User menu
    const userAction = document.getElementById('userAction');
    const userMenuModal = document.getElementById('userMenuModal');
    const closeBtn = document.querySelector('.close');
    
    if (userAction && userMenuModal) {
        userAction.addEventListener('click', () => {
            userMenuModal.classList.toggle('active');
        });
    }
    
    if (closeBtn && userMenuModal) {
        closeBtn.addEventListener('click', () => {
            userMenuModal.classList.remove('active');
        });
    }
    
    // Close modal on outside click
    if (userMenuModal) {
        window.addEventListener('click', (e) => {
            if (e.target === userMenuModal) {
                userMenuModal.classList.remove('active');
            }
        });
    }
    
    // Newsletter
    const newsletterBtn = document.querySelector('.newsletter-form button');
    if (newsletterBtn) {
        newsletterBtn.addEventListener('click', subscribeNewsletter);
    }
}

function updateUserMenu() {
    const menuContent = document.getElementById('userMenuContent');
    if (!menuContent) return;
    
    const isAuthenticated = window.apiClient.isAuthenticated();
    
    if (isAuthenticated) {
        const userInfo = JSON.parse(localStorage.getItem(window.CONFIG.STORAGE_KEYS.USER_INFO) || '{}');
        menuContent.innerHTML = `
            <div class="user-menu-item">
                <div style="text-align: center; padding-bottom: 10px; border-bottom: 1px solid #eee;">
                    <p style="margin: 0;"><strong>${userInfo.fullName || 'Người dùng'}</strong></p>
                    <p style="margin: 5px 0 0 0; font-size: 0.9rem; color: #666;">${userInfo.role === 'admin' ? 'Admin' : 'Khách hàng'}</p>
                </div>
                <a href="profile.html" class="menu-link"><i class="fas fa-user"></i> Hồ sơ</a>
                <a href="order-history.html" class="menu-link"><i class="fas fa-history"></i> Đơn hàng</a>
                ${userInfo.role === 'admin' ? '<a href="../admin/dashboard.html" class="menu-link"><i class="fas fa-chart-line"></i> Admin</a>' : ''}
                <a href="#" onclick="logout(event)" class="menu-link"><i class="fas fa-sign-out-alt"></i> Đăng xuất</a>
            </div>
        `;
    } else {
        menuContent.innerHTML = `
            <a href="auth/login.html" class="menu-link" style="display: block; text-align: center;"><i class="fas fa-sign-in-alt"></i> Đăng nhập</a>
            <a href="auth/register.html" class="menu-link" style="display: block; text-align: center;"><i class="fas fa-user-plus"></i> Đăng ký</a>
        `;
    }
}

function updateCartCount() {
    try {
        const cart = JSON.parse(localStorage.getItem(window.CONFIG.STORAGE_KEYS.CART) || '{}');
        const count = cart.totalItems || 0;
        const cartCountEl = document.getElementById('cartCount');
        if (cartCountEl) {
            cartCountEl.textContent = count;
            cartCountEl.style.display = count > 0 ? 'block' : 'none';
        }
    } catch (error) {
        console.error('Error updating cart count:', error);
    }
}

async function addToCart(event, productId) {
    event.stopPropagation();
    
    if (!window.apiClient.isAuthenticated()) {
        window.location.href = 'auth/login.html';
        return;
    }
    
    try {
        // Get product details
        const productData = await fetch(`${window.CONFIG.API_BASE_URL}/products/${productId}`)
            .then(r => r.json())
            .catch(() => null);
        
        if (!productData) {
            alert('Không thể thêm sản phẩm');
            return;
        }
        
        // Add to cart
        await window.CartAPI.addToCart({
            productId,
            quantity: 1,
            selectedSize: (productData.product?.size || [])[0],
            selectedColor: (productData.product?.color || [])[0]
        });
        
        updateCartCount();
        showNotification('Đã thêm vào giỏ hàng', 'success');
    } catch (error) {
        console.error('Error adding to cart:', error);
        showNotification('Lỗi khi thêm vào giỏ hàng', 'error');
    }
}

function navigateToProduct(slug) {
    window.location.href = `product-detail.html?slug=${slug}`;
}

function navigateToProducts(categoryId) {
    window.location.href = `product-list.html?category=${categoryId}`;
}

function searchProducts() {
    const query = document.getElementById('searchInput').value.trim();
    if (query) {
        window.location.href = `product-list.html?search=${encodeURIComponent(query)}`;
    }
}

async function subscribeNewsletter(event) {
    event.preventDefault();
    
    const email = document.getElementById('newsletterEmail').value.trim();
    
    if (!email) {
        showNotification('Vui lòng nhập email', 'warning');
        return;
    }
    
    // Just show success - no backend integration yet
    showNotification('Cảm ơn! Bạn đã đăng ký nhận thông tin', 'success');
    document.getElementById('newsletterEmail').value = '';
}

async function logout(event) {
    event.preventDefault();
    
    try {
        await window.AuthAPI.logout();
        window.apiClient.logout();
        showNotification('Đã đăng xuất thành công', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    } catch (error) {
        console.error('Logout error:', error);
        // Clear local storage anyway
        window.apiClient.logout();
        window.location.href = 'index.html';
    }
}

function showNotification(message, type = 'info') {
    const alertHTML = `
        <div class="alert alert-${type}" style="position: fixed; top: 80px; right: 20px; max-width: 400px; z-index: 9999;">
            ${message}
            <button onclick="this.parentElement.remove()" style="margin-left: 10px; background: none; border: none; cursor: pointer; color: inherit;">&times;</button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', alertHTML);
    
    setTimeout(() => {
        const alerts = document.querySelectorAll('.alert');
        alerts.forEach(alert => alert.remove());
    }, 3000);
}
