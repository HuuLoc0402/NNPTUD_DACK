const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Payment = require('../src/models/Payment');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const payment = await Payment.findOne({ paymentMethod: 'vnpay' }).sort({ createdAt: -1 }).lean();

  if (!payment) {
    console.log('Khong tim thay giao dich VNPay nao.');
    return;
  }

  const debug = payment.paymentGatewayResponse?.requestDebug || {};

  console.log('=== LAST VNPAY PAYMENT ===');
  console.log(JSON.stringify({
    paymentId: payment._id,
    order: payment.order,
    transactionId: payment.transactionId,
    status: payment.status,
    amount: payment.amount,
    createdAt: payment.createdAt,
    clientBaseUrl: payment.paymentGatewayResponse?.clientBaseUrl || '',
    hashMode: debug.hashMode || '',
    returnUrl: debug.returnUrl || '',
    queryString: debug.queryString || '',
    signData: debug.signData || '',
    secureHash: debug.secureHash || '',
    paymentUrl: debug.paymentUrl || '',
    params: debug.params || {}
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('Inspect last VNPay payment failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close();
  });