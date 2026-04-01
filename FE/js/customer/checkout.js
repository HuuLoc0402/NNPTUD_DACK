// Checkout Page JavaScript

let shippingData = {};
let paymentData = {};
let currentStep = 1;

document.addEventListener('DOMContentLoaded', () => {
    loadCheckoutData();
    setupEventListeners();
    updateCheckoutSummary();
});

function loadCheckoutData() {
    // Get user info if logged in
    const userInfo = localStorage.getItem(window.CONFIG.STORAGE_KEYS.USER_INFO);
    if (userInfo) {
        const user = JSON.parse(userInfo);
        document.querySelector('input[name="fullname"]').value = user.fullname || '';
        document.querySelector('input[name="email"]').value = user.email || '';
        document.querySelector('input[name="phone"]').value = user.phone || '';
    }

    loadCheckoutItems();
}

function loadCheckoutItems() {
    const cart = JSON.parse(localStorage.getItem(window.CONFIG.STORAGE_KEYS.CART) || '[]');
    const itemsContainer = document.getElementById('checkoutItemsList');
    const productsReview = document.getElementById('productsReview');

    let subtotal = 0;
    const itemsHtml = cart.map(item => {
        subtotal += item.price * item.quantity;
        return `
            <div class="summary-item">
                <img src="${item.image || 'placeholder.jpg'}" alt="${item.name}">
                <div class="summary-item-info">
                    <h4>${item.name}</h4>
                    <p>x${item.quantity}</p>
                    <div class="summary-item-price">${(item.price * item.quantity).toLocaleString('vi-VN')} đ</div>
                </div>
            </div>
        `;
    }).join('');

    itemsContainer.innerHTML = itemsHtml;

    // Products review
    productsReview.innerHTML = `
        <div style="max-height: 300px; overflow-y: auto;">
            ${cartHTML}
        </div>
    `;

    // Update amounts
    document.getElementById('checkoutSubtotal').textContent = subtotal.toLocaleString('vi-VN') + ' đ';
}

function setupEventListeners() {
    // Shipping form
    document.getElementById('shippingForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
    });

    // Next step buttons
    document.querySelectorAll('[onclick^="nextStep"]').forEach(btn => {
        // Already handled inline
    });

    // Payment form
    document.getElementById('paymentForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
    });

    // Confirm order button
    document.getElementById('confirmOrderBtn')?.addEventListener('click', confirmOrder);

    // Shipping method
    document.querySelectorAll('input[name="shipping"]').forEach(radio => {
        radio.addEventListener('change', updateCheckoutSummary);
    });
}

function nextStep(step) {
    // Validate current step before moving
    if (currentStep === 1 && !validateShippingForm()) {
        return;
    }

    currentStep = step;
    
    // Hide all steps
    document.querySelectorAll('.checkout-step').forEach(el => el.classList.remove('active'));
    document.getElementById(`step${step}`).classList.add('active');

    // Update progress
    document.querySelectorAll('.progress-step').forEach(el => el.classList.remove('active'));
    for (let i = 1; i <= step; i++) {
        document.querySelectorAll('.progress-step')[i - 1].classList.add('active');
    }

    if (step === 3) {
        displayOrderReview();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateShippingForm() {
    const inputs = document.querySelectorAll('#shippingForm input, #shippingForm select');
    let isValid = true;

    inputs.forEach(input => {
        if (!input.value) {
            showNotification(`Vui lòng nhập ${input.placeholder || input.name}`, 'error');
            isValid = false;
        }
    });

    return isValid;
}

function displayOrderReview() {
    // Shipping review
    const form = document.getElementById('shippingForm');
    const shippingMethod = document.querySelector('input[name="shipping"]:checked').value;
    
    shippingData = {
        fullname: form.fullname.value,
        email: form.email.value,
        phone: form.phone.value,
        province: form.province.value,
        district: form.district.value,
        address: form.address.value,
        shipping: shippingMethod
    };

    document.getElementById('shippingReview').innerHTML = `
        <p><strong>${shippingData.fullname}</strong></p>
        <p>${shippingData.phone} | ${shippingData.email}</p>
        <p>${shippingData.address}, ${shippingData.district}, ${shippingData.province}</p>
        <p>Vận chuyển: ${shippingMethod === 'express' ? 'Nhanh (1-2 ngày)' : 'Tiêu chuẩn (3-5 ngày)'}</p>
    `;

    // Payment review
    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
    const paymentNames = {
        'cod': 'Thanh toán khi nhận hàng',
        'vnpay': 'VNPay',
        'momo': 'MoMo',
        'vietqr': 'VietQR'
    };

    paymentData.method = paymentMethod;
    document.getElementById('paymentReview').innerHTML = `<p>${paymentNames[paymentMethod]}</p>`;
}

async function confirmOrder() {
    try {
        showLoading();
        
        const cart = JSON.parse(localStorage.getItem(window.CONFIG.STORAGE_KEYS.CART) || '[]');
        const shipping = document.querySelector('input[name="shipping"]:checked').value === 'express' ? 50000 : 0;
        const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const total = subtotal + shipping;

        const orderData = {
            items: cart,
            shippingAddress: {
                fullname: shippingData.fullname,
                email: shippingData.email,
                phone: shippingData.phone,
                province: shippingData.province,
                district: shippingData.district,
                address: shippingData.address
            },
            paymentMethod: paymentData.method,
            shippingCost: shipping,
            totalAmount: total,
            notes: 'Order from web'
        };

        const response = await window.OrderAPI.createOrder(orderData);

        if (response.success) {
            showNotification('Đặt hàng thành công!', 'success');

            // Process payment if not COD
            if (paymentData.method !== 'cod') {
                await processPayment(response.data._id, total, paymentData.method);
            } else {
                // Clear cart and redirect
                localStorage.removeItem(window.CONFIG.STORAGE_KEYS.CART);
                setTimeout(() => {
                    window.location.href = `order-success.html?orderId=${response.data._id}`;
                }, 1500);
            }
        }
    } catch (error) {
        showNotification('Lỗi: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function processPayment(orderId, amount, method) {
    try {
        let response;

        switch (method) {
            case 'vnpay':
                response = await window.PaymentAPI.processVNPay({
                    orderId,
                    amount,
                    orderInfo: `Payment for order ${orderId}`,
                    returnUrl: window.location.origin + '/FE/pages/customer/order-success.html'
                });
                if (response.data.paymentUrl) {
                    window.location.href = response.data.paymentUrl;
                }
                break;

            case 'momo':
                response = await window.PaymentAPI.processMoMo({
                    orderId,
                    amount,
                    orderInfo: `Payment for order ${orderId}`,
                    returnUrl: window.location.origin + '/FE/pages/customer/order-success.html'
                });
                if (response.data.payUrl) {
                    window.location.href = response.data.payUrl;
                }
                break;

            case 'vietqr':
                response = await window.PaymentAPI.processVietQR({
                    orderId,
                    amount,
                    orderInfo: `Payment for order ${orderId}`
                });
                if (response.data.qrUrl) {
                    showNotification('Vui lòng scan QR code để thanh toán', 'info');
                }
                break;
        }

        localStorage.removeItem(window.CONFIG.STORAGE_KEYS.CART);
    } catch (error) {
        showNotification('Lỗi xử lý thanh toán: ' + error.message, 'error');
    }
}

function updateCheckoutSummary() {
    const cart = JSON.parse(localStorage.getItem(window.CONFIG.STORAGE_KEYS.CART) || '[]');
    const shipping = document.querySelector('input[name="shipping"]:checked')?.value === 'express' ? 50000 : 0;

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discount = 0;
    const total = subtotal - discount + shipping;

    document.getElementById('checkoutSubtotal').textContent = subtotal.toLocaleString('vi-VN') + ' đ';
    document.getElementById('checkoutDiscount').textContent = discount.toLocaleString('vi-VN') + ' đ';
    document.getElementById('checkoutShipping').textContent = shipping === 0 ? 'Miễn phí' : shipping.toLocaleString('vi-VN') + ' đ';
    document.getElementById('checkoutTotal').textContent = total.toLocaleString('vi-VN') + ' đ';
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
