const nodemailer = require('nodemailer');

const formatCurrency = (value) => Number(value || 0).toLocaleString('vi-VN');
const formatDateTime = (value) => new Date(value || Date.now()).toLocaleString('vi-VN');
const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

class EmailSender {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  // Send order confirmation email
  async sendOrderConfirmation(userEmail, orderData) {
    const htmlContent = `
      <h1>Order Confirmation</h1>
      <p>Dear ${orderData.fullName},</p>
      <p>Thank you for your order!</p>
      
      <h2>Order Details</h2>
      <p><strong>Order Code:</strong> ${orderData.orderCode}</p>
      <p><strong>Order Date:</strong> ${new Date(orderData.createdAt).toLocaleDateString()}</p>
      
      <h2>Items</h2>
      <table border="1" cellpadding="10">
        <tr>
          <th>Product</th>
          <th>Quantity</th>
          <th>Price</th>
          <th>Total</th>
        </tr>
        ${orderData.items.map(item => `
          <tr>
            <td>${item.productName}</td>
            <td>${item.quantity}</td>
            <td>$${item.price}</td>
            <td>$${item.totalPrice}</td>
          </tr>
        `).join('')}
      </table>
      
      <h2>Payment Summary</h2>
      <p><strong>Subtotal:</strong> $${orderData.subtotal}</p>
      <p><strong>Shipping:</strong> $${orderData.shippingFee}</p>
      <p><strong>Tax:</strong> $${orderData.tax}</p>
      <p><strong>Total Amount:</strong> $${orderData.totalAmount}</p>
      
      <h2>Shipping Address</h2>
      <p>${orderData.shippingAddress.street}, ${orderData.shippingAddress.ward}</p>
      <p>${orderData.shippingAddress.district}, ${orderData.shippingAddress.province}</p>
      <p>Phone: ${orderData.shippingAddress.phone}</p>
      
      <p>Best regards,<br>MARC Fashion Team</p>
    `;

    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: userEmail,
        subject: `Order Confirmation - ${orderData.orderCode}`,
        html: htmlContent
      });
      return { success: true, message: 'Email sent successfully' };
    } catch (error) {
      console.error('Email sending error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send password reset email
  async sendPasswordReset(userEmail, resetLink) {
    const htmlContent = `
      <h1>Password Reset Request</h1>
      <p>You requested to reset your password.</p>
      <p><a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
      <p>If you didn't request this, please ignore this email.</p>
      <p>Best regards,<br>MARC Fashion Team</p>
    `;

    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: userEmail,
        subject: 'Password Reset Request',
        html: htmlContent
      });
      return { success: true };
    } catch (error) {
      console.error('Email sending error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send welcome email
  async sendWelcomeEmail(userEmail, userName) {
    const htmlContent = `
      <h1>Welcome to MARC Fashion!</h1>
      <p>Hi ${userName},</p>
      <p>Welcome to our fashion store. We're excited to have you as part of our community!</p>
      <p>Start exploring our collection of latest fashion trends at:</p>
      <p><a href="${process.env.CLIENT_URL}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Visit Our Store</a></p>
      <p>Best regards,<br>MARC Fashion Team</p>
    `;

    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: userEmail,
        subject: 'Welcome to MARC Fashion',
        html: htmlContent
      });
      return { success: true };
    } catch (error) {
      console.error('Email sending error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send payment notification
  async sendPaymentNotification(userEmail, paymentData) {
    const htmlContent = `
      <h1>Payment Confirmation</h1>
      <p>Dear ${paymentData.fullName},</p>
      <p>Your payment has been processed successfully.</p>
      
      <h2>Payment Details</h2>
      <p><strong>Transaction ID:</strong> ${paymentData.transactionId}</p>
      <p><strong>Amount:</strong> $${paymentData.amount}</p>
      <p><strong>Payment Method:</strong> ${paymentData.paymentMethod.toUpperCase()}</p>
      <p><strong>Status:</strong> ${paymentData.status}</p>
      <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
      
      <p>Best regards,<br>MARC Fashion Team</p>
    `;

    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: userEmail,
        subject: 'Payment Confirmation',
        html: htmlContent
      });
      return { success: true };
    } catch (error) {
      console.error('Email sending error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendInvoiceEmail(userEmail, invoiceData) {
    const shippingAddress = [
      invoiceData.shippingAddress?.street,
      invoiceData.shippingAddress?.ward,
      invoiceData.shippingAddress?.district,
      invoiceData.shippingAddress?.province,
      invoiceData.shippingAddress?.postalCode
    ].filter(Boolean).join(', ');

    const itemsHtml = (Array.isArray(invoiceData.items) ? invoiceData.items : []).map((item) => {
      const variantParts = [item.selectedColor, item.selectedSize].filter(Boolean).join(' / ');
      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #ece7e3;">${escapeHtml(item.productName || 'Sản phẩm')}</td>
          <td style="padding: 12px; border-bottom: 1px solid #ece7e3; text-align: center;">${Number(item.quantity || 0)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #ece7e3;">${escapeHtml(variantParts || 'Mặc định')}</td>
          <td style="padding: 12px; border-bottom: 1px solid #ece7e3; text-align: right;">${formatCurrency(item.price)} đ</td>
          <td style="padding: 12px; border-bottom: 1px solid #ece7e3; text-align: right;">${formatCurrency(item.totalPrice)} đ</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <div style="font-family: Arial, Helvetica, sans-serif; background: #f8f4ef; padding: 24px; color: #2b2b2b;">
        <div style="max-width: 760px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #eee3da;">
          <div style="padding: 28px 32px; background: linear-gradient(135deg, #fff1e4 0%, #fffaf5 100%); border-bottom: 1px solid #f0e3d7;">
            <div style="font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: #b85c38; font-weight: 700; margin-bottom: 8px;">MARC Fashion</div>
            <h1 style="margin: 0; font-size: 28px; line-height: 1.2; color: #2e3138;">Hóa đơn thanh toán</h1>
            <p style="margin: 10px 0 0; color: #626d79; line-height: 1.6;">Xin chào ${escapeHtml(invoiceData.fullName || 'quý khách')}, thanh toán của bạn đã được xác nhận thành công. Dưới đây là thông tin hóa đơn cho đơn hàng ${escapeHtml(invoiceData.orderCode)}.</p>
          </div>

          <div style="padding: 28px 32px;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr>
                <td style="padding: 0 0 8px; color: #7a818b;">Mã đơn hàng</td>
                <td style="padding: 0 0 8px; text-align: right; font-weight: 700;">${escapeHtml(invoiceData.orderCode)}</td>
              </tr>
              <tr>
                <td style="padding: 0 0 8px; color: #7a818b;">Mã giao dịch</td>
                <td style="padding: 0 0 8px; text-align: right; font-weight: 700;">${escapeHtml(invoiceData.transactionId || 'Đang cập nhật')}</td>
              </tr>
              <tr>
                <td style="padding: 0 0 8px; color: #7a818b;">Phương thức thanh toán</td>
                <td style="padding: 0 0 8px; text-align: right; font-weight: 700;">${escapeHtml(invoiceData.paymentMethodLabel || 'Thanh toán trực tuyến')}</td>
              </tr>
              <tr>
                <td style="padding: 0; color: #7a818b;">Thời gian xác nhận</td>
                <td style="padding: 0; text-align: right; font-weight: 700;">${formatDateTime(invoiceData.paidAt)}</td>
              </tr>
            </table>

            <h2 style="margin: 0 0 14px; font-size: 18px; color: #2e3138;">Chi tiết sản phẩm</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #ece7e3; border-radius: 12px; overflow: hidden;">
              <thead>
                <tr style="background: #faf5f0;">
                  <th style="padding: 12px; text-align: left; font-size: 13px;">Sản phẩm</th>
                  <th style="padding: 12px; text-align: center; font-size: 13px;">SL</th>
                  <th style="padding: 12px; text-align: left; font-size: 13px;">Phân loại</th>
                  <th style="padding: 12px; text-align: right; font-size: 13px;">Đơn giá</th>
                  <th style="padding: 12px; text-align: right; font-size: 13px;">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 320px); gap: 18px; align-items: start;">
              <div style="padding: 18px; border: 1px solid #ece7e3; border-radius: 14px; background: #fffdfb;">
                <h3 style="margin: 0 0 10px; font-size: 16px; color: #2e3138;">Thông tin nhận hàng</h3>
                <p style="margin: 0 0 6px; line-height: 1.6;"><strong>Người nhận:</strong> ${escapeHtml(invoiceData.fullName || '')}</p>
                <p style="margin: 0 0 6px; line-height: 1.6;"><strong>Số điện thoại:</strong> ${escapeHtml(invoiceData.phone || '')}</p>
                <p style="margin: 0; line-height: 1.6;"><strong>Địa chỉ:</strong> ${escapeHtml(shippingAddress || 'Chưa cập nhật')}</p>
              </div>

              <div style="padding: 18px; border: 1px solid #ece7e3; border-radius: 14px; background: #faf5f0;">
                <h3 style="margin: 0 0 12px; font-size: 16px; color: #2e3138;">Tổng thanh toán</h3>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #626d79;"><span>Tạm tính</span><strong>${formatCurrency(invoiceData.subtotal)} đ</strong></div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #626d79;"><span>Phí vận chuyển</span><strong>${formatCurrency(invoiceData.shippingFee)} đ</strong></div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #626d79;"><span>Thuế</span><strong>${formatCurrency(invoiceData.tax)} đ</strong></div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px; color: #626d79;"><span>Giảm giá</span><strong>${formatCurrency(invoiceData.discount)} đ</strong></div>
                <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px solid #e4d4c6; font-size: 18px;"><span><strong>Tổng cộng</strong></span><strong style="color: #b85c38;">${formatCurrency(invoiceData.totalAmount)} đ</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    try {
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: userEmail,
        subject: `Hóa đơn thanh toán - ${invoiceData.orderCode}`,
        html: htmlContent
      });
      return { success: true, messageId: info?.messageId || '' };
    } catch (error) {
      console.error('Invoice email sending error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailSender();
