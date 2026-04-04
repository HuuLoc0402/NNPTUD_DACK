const Order = require('../models/Order');
const EmailSender = require('./emailSender');

const PAYMENT_METHOD_LABELS = {
  vnpay: 'VNPay',
  momo: 'MoMo',
  vietqr: 'VietQR',
  cod: 'Thanh toán khi nhận hàng'
};

const getRecipientEmail = (order) => {
  return String(order?.shippingAddress?.email || order?.user?.email || '').trim();
};

const toPlainOrder = (order) => (order?.toObject ? order.toObject() : order);

async function sendInvoiceEmailForCompletedOrder({ order, payment = null }) {
  const plainOrder = toPlainOrder(order);

  if (!plainOrder?._id || plainOrder.paymentStatus !== 'completed') {
    return { success: false, skipped: true, reason: 'order-not-completed' };
  }

  if (plainOrder.invoiceEmailSentAt) {
    return { success: true, skipped: true, reason: 'already-sent' };
  }

  const recipientEmail = getRecipientEmail(plainOrder);
  if (!recipientEmail) {
    return { success: false, skipped: true, reason: 'missing-recipient-email' };
  }

  const invoicePayload = {
    orderCode: plainOrder.orderCode,
    fullName: plainOrder.shippingAddress?.fullName || plainOrder.user?.fullName || '',
    phone: plainOrder.shippingAddress?.phone || plainOrder.user?.phone || '',
    shippingAddress: plainOrder.shippingAddress || {},
    items: Array.isArray(plainOrder.items) ? plainOrder.items : [],
    subtotal: plainOrder.subtotal,
    shippingFee: plainOrder.shippingFee,
    tax: plainOrder.tax,
    discount: plainOrder.discount,
    totalAmount: plainOrder.totalAmount,
    transactionId: payment?.transactionId || plainOrder.transactionId || '',
    paymentMethodLabel: PAYMENT_METHOD_LABELS[payment?.paymentMethod || plainOrder.paymentMethod] || plainOrder.paymentMethod,
    paidAt: payment?.completedAt || plainOrder.completedAt || plainOrder.updatedAt || new Date()
  };

  const result = await EmailSender.sendInvoiceEmail(recipientEmail, invoicePayload);
  if (!result.success) {
    return { success: false, skipped: false, reason: 'send-failed', error: result.error };
  }

  await Order.findByIdAndUpdate(plainOrder._id, {
    invoiceEmailSentAt: new Date(),
    invoiceEmailRecipient: recipientEmail
  });

  return {
    success: true,
    skipped: false,
    recipientEmail,
    messageId: result.messageId || ''
  };
}

module.exports = {
  sendInvoiceEmailForCompletedOrder
};