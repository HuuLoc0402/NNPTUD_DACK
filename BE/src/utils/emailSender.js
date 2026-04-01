const nodemailer = require('nodemailer');

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
}

module.exports = new EmailSender();
