// Product Detail Page JavaScript

let currentProduct = null;
let selectedRating = 0;

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');

    if (!slug) {
        window.location.href = 'product-list.html';
        return;
    }

    await loadProductDetail(slug);
    setupEventListeners();
    updateCartCount();
});

async function loadProductDetail(slug) {
    try {
        showLoading();
        const response = await window.ProductAPI.getProduct(slug);

        if (response.success) {
            currentProduct = response.data;
            displayProductDetail(currentProduct);
            loadRelatedProducts(currentProduct.category);
        }
    } catch (error) {
        showNotification('Lỗi khi tải sản phẩm: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function displayProductDetail(product) {
    // Update breadcrumb
    document.getElementById('productName').textContent = product.name;

    // Product title and rating
    document.getElementById('productTitle').textContent = product.name;
    displayStars(Math.round(product.rating || 4), '#ratingStars');
    document.getElementById('ratingCount').textContent = `(${product.reviews?.length || 0} đánh giá)`;
    document.getElementById('soldCount').textContent = `${product.sold || 0} đã bán`;

    // Price
    const currentPrice = product.currentPrice || product.price;
    document.getElementById('currentPrice').textContent = currentPrice.toLocaleString('vi-VN') + ' đ';
    
    if (product.discount) {
        document.getElementById('originalPrice').textContent = product.price.toLocaleString('vi-VN') + ' đ';
        document.getElementById('discountPercent').textContent = `-${product.discount}%`;
    } else {
        document.getElementById('originalPrice').style.display = 'none';
        document.getElementById('discountPercent').style.display = 'none';
    }

    // Images
    if (product.images && product.images.length > 0) {
        document.getElementById('mainImage').src = product.images[0];
        const thumbContainer = document.getElementById('thumbnailsContainer');
        thumbContainer.innerHTML = product.images.map((img, idx) => `
            <div class="thumbnail ${idx === 0 ? 'active' : ''}" onclick="changeImage('${img}', this)">
                <img src="${img}" alt="Thumbnail ${idx + 1}">
            </div>
        `).join('');
    }

    // Size options
    const sizeContainer = document.getElementById('sizeOptions');
    if (product.sizes) {
        sizeContainer.innerHTML = product.sizes.map(size => `
            <button class="size-btn" onclick="selectSize(this, '${size}')">${size}</button>
        `).join('');
    }

    // Color options
    const colorContainer = document.getElementById('colorOptions');
    if (product.colors) {
        colorContainer.innerHTML = product.colors.map(color => `
            <button class="color-option" onclick="selectColor(this, '${color}')" title="${color}">
                <span style="background-color: ${getColorCode(color)};"></span>
            </button>
        `).join('');
    }

    // Stock info
    const stockInfo = document.getElementById('stockInfo');
    if (product.stock > 0) {
        stockInfo.textContent = `Còn ${product.stock} sản phẩm`;
        stockInfo.style.color = '#28a745';
    } else {
        stockInfo.textContent = 'Hết hàng';
        stockInfo.style.color = '#dc3545';
        document.getElementById('addToCartBtn').disabled = true;
        document.getElementById('buyNowBtn').disabled = true;
    }

    // Description
    document.getElementById('productDescription').innerHTML = product.description || 'Không có mô tả';

    // Specifications
    if (product.specifications) {
        const specsHtml = Object.entries(product.specifications).map(([key, value]) => `
            <tr>
                <td><strong>${key}</strong></td>
                <td>${value}</td>
            </tr>
        `).join('');
        document.getElementById('productSpecs').innerHTML = `<table>${specsHtml}</table>`;
    }

    // Reviews
    loadReviews(product._id);
}

function displayStars(rating, elementId) {
    const container = document.querySelector(elementId);
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        stars += i <= rating ? '★' : '☆';
    }
    container.textContent = stars;
    container.style.color = '#ffd700';
}

function changeImage(imageSrc, element) {
    document.getElementById('mainImage').src = imageSrc;
    document.querySelectorAll('.thumbnail').forEach(thumb => thumb.classList.remove('active'));
    element.classList.add('active');
}

function selectSize(button, size) {
    document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
}

function selectColor(button, color) {
    document.querySelectorAll('.color-option').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
}

function setupEventListeners() {
    document.getElementById('decreaseQty').addEventListener('click', () => {
        const input = document.getElementById('quantityInput');
        if (parseInt(input.value) > 1) {
            input.value = parseInt(input.value) - 1;
        }
    });

    document.getElementById('increaseQty').addEventListener('click', () => {
        const input = document.getElementById('quantityInput');
        if (currentProduct && parseInt(input.value) < currentProduct.stock) {
            input.value = parseInt(input.value) + 1;
        }
    });

    document.getElementById('addToCartBtn').addEventListener('click', addToCart);
    document.getElementById('buyNowBtn').addEventListener('click', buyNow);
    document.getElementById('wishlistBtn').addEventListener('click', toggleWishlist);

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            const tabId = e.target.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Star rating for reviews
    document.querySelectorAll('.star-rating i').forEach(star => {
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.getAttribute('data-rating'));
            document.querySelectorAll('.star-rating i').forEach((s, idx) => {
                s.classList.toggle('active', idx < selectedRating);
            });
        });
    });

    // Submit review
    document.getElementById('submitReviewForm')?.addEventListener('submit', submitReview);
}

async function addToCart() {
    const size = document.querySelector('.size-btn.active')?.textContent || 'M';
    const color = document.querySelector('.color-option.active')?.title || 'default';
    const quantity = parseInt(document.getElementById('quantityInput').value);

    const cart = JSON.parse(localStorage.getItem(window.CONFIG.STORAGE_KEYS.CART) || '[]');
    const cartItem = {
        productId: currentProduct._id,
        name: currentProduct.name,
        price: currentProduct.currentPrice || currentProduct.price,
        quantity,
        size,
        color,
        image: currentProduct.images?.[0],
        slug: currentProduct.slug
    };

    const existingItem = cart.find(item => 
        item.productId === cartItem.productId && 
        item.size === cartItem.size && 
        item.color === cartItem.color
    );

    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push(cartItem);
    }

    localStorage.setItem(window.CONFIG.STORAGE_KEYS.CART, JSON.stringify(cart));
    updateCartCount();
    showNotification('Đã thêm vào giỏ hàng!', 'success');
}

function buyNow() {
    addToCart();
    setTimeout(() => {
        window.location.href = 'cart.html';
    }, 500);
}

function toggleWishlist() {
    const btn = document.getElementById('wishlistBtn');
    btn.classList.toggle('active');
    showNotification(
        btn.classList.contains('active') ? 'Đã thêm vào yêu thích' : 'Đã xóa khỏi yêu thích',
        'success'
    );
}

async function loadReviews(productId) {
    try {
        const response = await window.CommentAPI.getProductComments(productId, { page: 1, limit: 10 });
        if (response.success) {
            const reviewsList = document.getElementById('reviewsList');
            if (response.data.length === 0) {
                reviewsList.innerHTML = '<p>Chưa có đánh giá nào</p>';
            } else {
                reviewsList.innerHTML = response.data.map(review => `
                    <div class="review-item">
                        <div class="review-header">
                            <span class="review-author">${review.user?.fullname || 'Khách hàng'}</span>
                            <span class="review-date">${new Date(review.createdAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <div class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
                        <div class="review-text">${review.content}</div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Lỗi khi tải đánh giá:', error);
    }
}

async function submitReview(e) {
    e.preventDefault();
    if (!window.apiClient.isAuthenticated()) {
        showNotification('Vui lòng đăng nhập để viết đánh giá', 'info');
        return;
    }

    try {
        const response = await window.CommentAPI.createComment({
            productId: currentProduct._id,
            rating: selectedRating,
            content: document.getElementById('reviewText').value
        });

        if (response.success) {
            showNotification('Cảm ơn đã viết đánh giá!', 'success');
            loadReviews(currentProduct._id);
            document.getElementById('submitReviewForm').reset();
        }
    } catch (error) {
        showNotification('Lỗi: ' + error.message, 'error');
    }
}

async function loadRelatedProducts(categoryId) {
    try {
        const response = await window.ProductAPI.getProducts({ category: categoryId, limit: 4 });
        if (response.success) {
            const list = document.getElementById('relatedProductsList');
            list.innerHTML = response.data.slice(0, 4).map(product => `
                <div class="product-card" onclick="navigateToProduct('${product.slug}')">
                    <div class="product-image">
                        <img src="${product.images?.[0] || 'placeholder.jpg'}" alt="${product.name}">
                    </div>
                    <div class="product-details">
                        <h3 class="product-name">${product.name}</h3>
                        <div class="product-price">
                            <span class="price-current">${(product.currentPrice || product.price).toLocaleString('vi-VN')} đ</span>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Lỗi khi tải sản phẩm liên quan:', error);
    }
}

function navigateToProduct(slug) {
    window.location.href = `product-detail.html?slug=${slug}`;
}

function getColorCode(colorName) {
    const colors = {
        'red': '#ff6b6b',
        'blue': '#4ecdc4',
        'green': '#95e1d3',
        'yellow': '#ffd93d',
        'black': '#2c3e50',
        'white': '#ffffff',
        'gray': '#95a5a6',
        'brown': '#8b4513'
    };
    return colors[colorName.toLowerCase()] || colorName;
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
