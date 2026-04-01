// Products List Page JavaScript

let currentPage = 1;
const itemsPerPage = 12;
let allProducts = [];
let filteredProducts = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadProducts();
    setupEventListeners();
    updateCartCount();
});

async function loadProducts() {
    try {
        showLoading();
        const response = await window.ProductAPI.getProducts({
            page: 1,
            limit: 100
        });

        if (response.success) {
            allProducts = response.data;
            filteredProducts = [...allProducts];
            displayProducts(filteredProducts.slice(0, itemsPerPage));
            loadCategories();
            createPagination();
        }
    } catch (error) {
        showNotification('Lỗi khi tải sản phẩm: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function loadCategories() {
    try {
        const response = await window.CategoryAPI.getCategories();
        if (response.success) {
            const categoriesFilter = document.getElementById('categoriesFilter');
            categoriesFilter.innerHTML = response.data.map(cat => `
                <label>
                    <input type="checkbox" name="category" value="${cat._id}" data-name="${cat.name}">
                    ${cat.name}
                </label>
            `).join('');

            document.querySelectorAll('input[name="category"]').forEach(checkbox => {
                checkbox.addEventListener('change', applyFilters);
            });
        }
    } catch (error) {
        console.error('Lỗi khi tải danh mục:', error);
    }
}

function displayProducts(products) {
    const productsList = document.getElementById('productsList');
    
    if (products.length === 0) {
        productsList.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px;">Không tìm thấy sản phẩm nào</p>';
        return;
    }

    productsList.innerHTML = products.map(product => `
        <div class="product-card" onclick="navigateToProduct('${product.slug}')">
            <div class="product-image">
                <img src="${product.images?.[0] || 'placeholder.jpg'}" alt="${product.name}">
                ${product.discount ? `<span class="product-badge sale">-${product.discount}%</span>` : ''}
            </div>
            <div class="product-details">
                <h3 class="product-name">${product.name}</h3>
                <div class="product-rating">
                    <span class="stars">${'★'.repeat(Math.round(product.rating || 4))}${'☆'.repeat(5 - Math.round(product.rating || 4))}</span>
                    <span class="count">(${product.reviews?.length || 0})</span>
                </div>
                <div class="product-price">
                    <span class="price-current">${(product.currentPrice || product.price)?.toLocaleString('vi-VN')} đ</span>
                    ${product.discount ? `<span class="price-original">${product.price?.toLocaleString('vi-VN')} đ</span>` : ''}
                </div>
                <div class="product-actions">
                    <button class="btn-add-cart" onclick="addToCart(event, '${product._id}')">
                        <i class="fas fa-shopping-cart"></i> Thêm
                    </button>
                    <button class="btn-wishlist" onclick="toggleWishlist(event, '${product._id}')">
                        <i class="far fa-heart"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function setupEventListeners() {
    // Sort
    document.getElementById('sortSelect').addEventListener('change', (e) => {
        const sorted = sortProducts(filteredProducts, e.target.value);
        displayProducts(sorted.slice(0, itemsPerPage));
    });

    // Price range
    const priceMin = document.getElementById('priceMin');
    const priceMax = document.getElementById('priceMax');
    
    priceMin.addEventListener('input', () => {
        document.getElementById('priceMinValue').textContent = parseInt(priceMin.value).toLocaleString('vi-VN') + ' đ';
        applyFilters();
    });

    priceMax.addEventListener('input', () => {
        document.getElementById('priceMaxValue').textContent = parseInt(priceMax.value).toLocaleString('vi-VN') + ' đ';
        applyFilters();
    });

    // Size filter
    document.querySelectorAll('input[name="size"], input[name="color"], input[name="rating"]').forEach(checkbox => {
        checkbox.addEventListener('change', applyFilters);
    });

    // Clear filters
    document.getElementById('clearFilters').addEventListener('click', clearAllFilters);

    // Search
    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchProducts(e.target.value);
        }, 300);
    });
}

function applyFilters() {
    filteredProducts = allProducts.filter(product => {
        // Category filter
        const categories = Array.from(document.querySelectorAll('input[name="category"]:checked')).map(el => el.value);
        if (categories.length > 0 && !categories.includes(product.category)) {
            return false;
        }

        // Price filter
        const priceMin = parseInt(document.getElementById('priceMin').value);
        const priceMax = parseInt(document.getElementById('priceMax').value);
        const price = product.currentPrice || product.price;
        if (price < priceMin || price > priceMax) {
            return false;
        }

        // Size filter
        const sizes = Array.from(document.querySelectorAll('input[name="size"]:checked')).map(el => el.value);
        if (sizes.length > 0 && !product.sizes?.some(s => sizes.includes(s))) {
            return false;
        }

        // Color filter
        const colors = Array.from(document.querySelectorAll('input[name="color"]:checked')).map(el => el.value);
        if (colors.length > 0 && !product.colors?.some(c => colors.includes(c))) {
            return false;
        }

        // Rating filter
        const ratings = Array.from(document.querySelectorAll('input[name="rating"]:checked')).map(el => parseInt(el.value));
        if (ratings.length > 0 && !ratings.some(r => Math.round(product.rating || 4) >= r)) {
            return false;
        }

        return true;
    });

    currentPage = 1;
    displayProducts(filteredProducts.slice(0, itemsPerPage));
    createPagination();
}

function searchProducts(query) {
    filteredProducts = allProducts.filter(product => 
        product.name.toLowerCase().includes(query.toLowerCase())
    );
    currentPage = 1;
    displayProducts(filteredProducts.slice(0, itemsPerPage));
    createPagination();
}

function sortProducts(products, sortType) {
    const sorted = [...products];
    switch (sortType) {
        case 'price-low':
            return sorted.sort((a, b) => (a.currentPrice || a.price) - (b.currentPrice || b.price));
        case 'price-high':
            return sorted.sort((a, b) => (b.currentPrice || b.price) - (a.currentPrice || a.price));
        case 'rating':
            return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        case 'popular':
            return sorted.sort((a, b) => (b.views || 0) - (a.views || 0));
        default:
            return sorted;
    }
}

function clearAllFilters() {
    document.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(el => el.checked = false);
    document.getElementById('priceMin').value = 0;
    document.getElementById('priceMax').value = 10000000;
    document.getElementById('priceMinValue').textContent = '0 đ';
    document.getElementById('priceMaxValue').textContent = '10.000.000 đ';
    filteredProducts = [...allProducts];
    currentPage = 1;
    displayProducts(filteredProducts.slice(0, itemsPerPage));
    createPagination();
}

function createPagination() {
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const paginationContainer = document.getElementById('paginationContainer');
    let html = '';

    if (currentPage > 1) {
        html += `<a href="javascript:void(0)" onclick="goToPage(${currentPage - 1})"><i class="fas fa-chevron-left"></i></a>`;
    }

    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            html += `<span class="active">${i}</span>`;
        } else if (i <= currentPage + 2 && i >= currentPage - 2) {
            html += `<a href="javascript:void(0)" onclick="goToPage(${i})">${i}</a>`;
        }
    }

    if (currentPage < totalPages) {
        html += `<a href="javascript:void(0)" onclick="goToPage(${currentPage + 1})"><i class="fas fa-chevron-right"></i></a>`;
    }

    paginationContainer.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    displayProducts(filteredProducts.slice(start, end));
    createPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function navigateToProduct(slug) {
    window.location.href = `product-detail.html?slug=${slug}`;
}

async function addToCart(event, productId) {
    event.stopPropagation();
    try {
        const product = allProducts.find(p => p._id === productId);
        const cart = JSON.parse(localStorage.getItem(window.CONFIG.STORAGE_KEYS.CART) || '[]');
        
        const existingItem = cart.find(item => item.productId === productId && item.size === 'M' && item.color === 'default');
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({
                productId,
                name: product.name,
                price: product.currentPrice || product.price,
                quantity: 1,
                size: 'M',
                color: 'default',
                image: product.images?.[0]
            });
        }

        localStorage.setItem(window.CONFIG.STORAGE_KEYS.CART, JSON.stringify(cart));
        updateCartCount();
        showNotification('Đã thêm vào giỏ hàng!', 'success');
    } catch (error) {
        showNotification('Lỗi: ' + error.message, 'error');
    }
}

function toggleWishlist(event, productId) {
    event.stopPropagation();
    const btn = event.target.closest('.btn-wishlist');
    btn.classList.toggle('active');
    showNotification(btn.classList.contains('active') ? 'Đã thêm vào yêu thích' : 'Đã xóa khỏi yêu thích', 'success');
}

function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem(window.CONFIG.STORAGE_KEYS.CART) || '[]');
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cartCount').textContent = count;
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
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function getIcon(type) {
    return {
        'success': 'check-circle',
        'error': 'exclamation-circle',
        'info': 'info-circle'
    }[type] || 'info-circle';
}

function showLoading() {
    const loader = document.createElement('div');
    loader.id = 'loader';
    loader.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(loader);
}

function hideLoading() {
    const loader = document.getElementById('loader');
    if (loader) loader.remove();
}
