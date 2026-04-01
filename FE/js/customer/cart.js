// Shopping Cart Page JavaScript

document.addEventListener('DOMContentLoaded', () => {
    loadCart();
    setupEventListeners();
});

function loadCart() {
    const cart = JSON.parse(localStorage.getItem(window.CONFIG.STORAGE_KEYS.CART) || '[]');
    const cartItemsList = document.getElementById('cartItemsList');
    const emptyCart = document.getElementById('emptyCart');
    const cartTableContainer = document.getElementById('cartTableContainer');

    if (cart.length === 0) {
        emptyCart.style.display = 'block';
        cartTableContainer.style.display = 'none';
        updateCartSummary([]);
        return;
    }

    emptyCart.style.display = 'none';
    cartTableContainer.style.display = 'block';

    cartItemsList.innerHTML = cart.map((item, index) => `
        <tr>
            <td><input type="checkbox" class="item-checkbox" checked></td>
            <td>
                <div class="cart-item">
                    <div class="item-image">
                        <img src="${item.image || 'placeholder.jpg'}" alt="${item.name}">
                    </div>
                    <div class="item-details">
                        <h4>${item.name}</h4>
                        <p>Kích cỡ: ${item.size} | Màu: ${item.color}</p>
                    </div>
                </div>
            </td>
            <td class="item-price">${(item.price || 0).toLocaleString('vi-VN')} đ</td>
            <td>
                <div class="quantity-control">
                    <button onclick="updateQuantity(${index}, -1)">-</button>
                    <input type="number" value="${item.quantity}" min="1" readonly>
                    <button onclick="updateQuantity(${index}, 1)">+</button>
                </div>
            </td>
            <td class="item-total">${(item.price * item.quantity || 0).toLocaleString('vi-VN')} đ</td>
            <td>
                <span class="item-remove" onclick="removeItem(${index})">
                    <i class="fas fa-trash"></i>
                </span>
            </td>
        </tr>
    `).join('');

    updateCartSummary(cart);
}

function setupEventListeners() {
    const selectAllCheckbox = document.getElementById('selectAll');
    selectAllCheckbox?.addEventListener('change', (e) => {
        document.querySelectorAll('.item-checkbox').forEach(checkbox => {
            checkbox.checked = e.target.checked;
        });
        updateCartSummary(getSelectedItems());
    });

    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('item-checkbox')) {
            updateCartSummary(getSelectedItems());
        }
    });

    document.getElementById('useVoucher')?.addEventListener('change', (e) => {
        document.getElementById('voucherInput').style.display = e.target.checked ? 'flex' : 'none';
    });

    document.getElementById('applyVoucherBtn')?.addEventListener('click', applyVoucher);
    document.getElementById('checkoutBtn')?.addEventListener('click', proceedToCheckout);
}

function updateQuantity(index, change) {
    const cart = JSON.parse(localStorage.getItem(window.CONFIG.STORAGE_KEYS.CART) || '[]');
    const newQuantity = Math.max(1, cart[index].quantity + change);
    cart[index].quantity = newQuantity;
    localStorage.setItem(window.CONFIG.STORAGE_KEYS.CART, JSON.stringify(cart));
    loadCart();
}

function removeItem(index) {
    if (confirm('Bạn có chắc muốn xóa sản phẩm này?')) {
        const cart = JSON.parse(localStorage.getItem(window.CONFIG.STORAGE_KEYS.CART) || '[]');
        cart.splice(index, 1);
        localStorage.setItem(window.CONFIG.STORAGE_KEYS.CART, JSON.stringify(cart));
        loadCart();
        showNotification('Đã xóa sản phẩm', 'success');
    }
}

function getSelectedItems() {
    const cart = JSON.parse(localStorage.getItem(window.CONFIG.STORAGE_KEYS.CART) || '[]');
    const checkboxes = document.querySelectorAll('.item-checkbox:checked');
    return Array.from(checkboxes).map((_, index) => cart[index]).filter(Boolean);
}

function updateCartSummary(items) {
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity || 0), 0);
    const discount = 0; // Can be calculated based on voucher
    const shipping = subtotal >= 500000 ? 0 : 30000;
    const total = subtotal - discount + shipping;

    document.getElementById('subtotal').textContent = subtotal.toLocaleString('vi-VN') + ' đ';
    document.getElementById('discount').textContent = discount.toLocaleString('vi-VN') + ' đ';
    document.getElementById('shipping').textContent = shipping === 0 ? 'Miễn phí' : shipping.toLocaleString('vi-VN') + ' đ';
    document.getElementById('total').textContent = total.toLocaleString('vi-VN') + ' đ';
}

function applyVoucher() {
    const voucherCode = document.getElementById('voucherCode').value;
    if (!voucherCode) {
        showNotification('Vui lòng nhập mã voucher', 'info');
        return;
    }
    // TODO: Call API to validate voucher
    showNotification('Mã voucher hợp lệ!', 'success');
}

function proceedToCheckout() {
    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) {
        showNotification('Vui lòng chọn sản phẩm để thanh toán', 'info');
        return;
    }

    if (!window.apiClient.isAuthenticated()) {
        showNotification('Vui lòng đăng nhập để thanh toán', 'info');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
        return;
    }

    window.location.href = 'checkout.html';
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
