const Order = require('../models/Order');
const Payment = require('../models/Payment');
const PaymentGateway = require('../utils/paymentGateway');
const EmailSender = require('../utils/emailSender');
const User = require('../models/User');

exports.processVNPayPayment = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Generate VNPay payment URL
    const paymentUrl = PaymentGateway.generateVNPayURL({
      orderCode: order.orderCode,
      totalAmount: order.totalAmount,
      ipAddress: req.ip
    });

    // Save payment record
    const payment = new Payment({
      order: orderId,
      user: order.user,
      amount: order.totalAmount,
      paymentMethod: 'vnpay',
      status: 'pending',
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    await payment.save();

    res.status(200).json({
      success: true,
      message: 'Payment URL generated',
      paymentUrl,
      paymentId: payment._id
    });
  } catch (error) {
    next(error);
  }
};

exports.handleVNPayCallback = async (req, res, next) => {
  try {
    const vnp_Params = req.query;

    // Verify signature
    const isValid = PaymentGateway.verifyVNPayResponse(vnp_Params);

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const orderCode = vnp_Params['vnp_TxnRef'];
    const responseCode = vnp_Params['vnp_ResponseCode'];
    const transactionId = vnp_Params['vnp_TransactionNo'];

    // Find order
    const order = await Order.findOne({ orderCode });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Update payment status
    const payment = await Payment.findOne({ order: order._id });

    if (responseCode === '00') {
      // Payment success
      order.paymentStatus = 'completed';
      order.transactionId = transactionId;
      order.orderStatus = 'confirmed';
      payment.status = 'completed';
      payment.transactionId = transactionId;
      payment.responseCode = responseCode;

      await order.save();
      await payment.save();

      // Send confirmation email
      const user = await User.findById(order.user);
      await EmailSender.sendPaymentNotification(user.email, {
        fullName: user.fullName,
        amount: order.totalAmount,
        transactionId,
        paymentMethod: 'vnpay',
        status: 'completed'
      });

      return res.status(200).json({
        success: true,
        message: 'Payment successful',
        orderId: order._id
      });
    } else {
      // Payment failed
      order.paymentStatus = 'failed';
      payment.status = 'failed';
      payment.responseCode = responseCode;
      payment.failureReason = vnp_Params['vnp_Message'];

      await order.save();
      await payment.save();

      return res.status(400).json({
        success: false,
        message: 'Payment failed',
        reason: vnp_Params['vnp_Message']
      });
    }
  } catch (error) {
    next(error);
  }
};

exports.processMoMoPayment = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Generate MoMo payment
    const momoPayment = await PaymentGateway.generateMoMoPayment({
      orderCode: order.orderCode,
      totalAmount: order.totalAmount
    });

    // Save payment record
    const payment = new Payment({
      order: orderId,
      user: order.user,
      amount: order.totalAmount,
      paymentMethod: 'momo',
      status: 'pending',
      paymentGatewayResponse: momoPayment
    });

    await payment.save();

    res.status(200).json({
      success: true,
      message: 'MoMo payment created',
      paymentData: momoPayment,
      paymentId: payment._id
    });
  } catch (error) {
    next(error);
  }
};

exports.handleMoMoCallback = async (req, res, next) => {
  try {
    const { orderId, resultCode, transId, amount, signature } = req.body;

    // Verify signature
    const isValid = PaymentGateway.verifyMoMoSignature(req.body, signature);

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    // Find order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const payment = await Payment.findOne({ order: orderId });

    if (resultCode === 0) {
      // Payment success
      order.paymentStatus = 'completed';
      order.transactionId = transId;
      order.orderStatus = 'confirmed';
      payment.status = 'completed';
      payment.transactionId = transId;

      await order.save();
      await payment.save();

      // Send email
      const user = await User.findById(order.user);
      await EmailSender.sendPaymentNotification(user.email, {
        fullName: user.fullName,
        amount,
        transactionId: transId,
        paymentMethod: 'momo',
        status: 'completed'
      });

      return res.status(200).json({
        success: true,
        message: 'Payment successful',
        orderId: order._id
      });
    } else {
      // Payment failed
      order.paymentStatus = 'failed';
      payment.status = 'failed';

      await order.save();
      await payment.save();

      return res.status(400).json({
        success: false,
        message: 'Payment failed'
      });
    }
  } catch (error) {
    next(error);
  }
};

exports.processVietQRPayment = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Generate VietQR payment
    const vietqrPayment = PaymentGateway.generateVietQRPayment({
      orderCode: order.orderCode,
      totalAmount: order.totalAmount
    });

    // Save payment record
    const payment = new Payment({
      order: orderId,
      user: order.user,
      amount: order.totalAmount,
      paymentMethod: 'vietqr',
      status: 'pending',
      paymentGatewayResponse: vietqrPayment
    });

    await payment.save();

    res.status(200).json({
      success: true,
      message: 'VietQR payment created',
      paymentData: vietqrPayment,
      paymentId: payment._id
    });
  } catch (error) {
    next(error);
  }
};

exports.getPaymentStatus = async (req, res, next) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId)
      .populate('order');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    res.status(200).json({
      success: true,
      payment
    });
  } catch (error) {
    next(error);
  }
};

exports.getOrderPayments = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const payments = await Payment.find({ order: orderId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: payments
    });
  } catch (error) {
    next(error);
  }
};

exports.getAllPayments = async (req, res, next) => {
  try {
    const payments = await Payment.find()
      .populate('order')
      .populate('user')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: payments
    });
  } catch (error) {
    next(error);
  }
};
