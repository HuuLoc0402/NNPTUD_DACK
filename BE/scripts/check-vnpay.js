const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PaymentGateway = require('../src/utils/paymentGateway');

const REQUIRED_PARAMS = [
  'vnp_Version',
  'vnp_Command',
  'vnp_TmnCode',
  'vnp_Amount',
  'vnp_CreateDate',
  'vnp_CurrCode',
  'vnp_IpAddr',
  'vnp_Locale',
  'vnp_OrderInfo',
  'vnp_OrderType',
  'vnp_ReturnUrl',
  'vnp_TxnRef',
  'vnp_ExpireDate',
  'vnp_SecureHash'
];

function maskSecret(value) {
  const source = String(value || '');
  if (!source) {
    return '(empty)';
  }

  if (source.length <= 8) {
    return `${source.slice(0, 2)}***${source.slice(-2)}`;
  }

  return `${source.slice(0, 4)}***${source.slice(-4)}`;
}

function formatCheck(label, ok, detail) {
  return `${ok ? '[OK]' : '[FAIL]'} ${label}${detail ? `: ${detail}` : ''}`;
}

function buildIndependentHashData(params) {
  const queryParams = new URLSearchParams();
  Object.keys(params)
    .sort()
    .forEach((key) => {
      queryParams.append(key, String(params[key] ?? ''));
    });

  return queryParams.toString();
}

function buildIndependentRawHashData(params) {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${String(params[key] ?? '')}`)
    .join('&');
}

function isPublicUrl(value) {
  const source = String(value || '').trim();
  if (!/^https?:\/\//i.test(source)) {
    return false;
  }

  return !/127\.0\.0\.1|localhost|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\./i.test(source);
}

async function checkMerchantCode(tmnCode) {
  try {
    const response = await axios.post(
      'https://sandbox.vnpayment.vn/qrpayauth/api/merchant/get_bank_list',
      new URLSearchParams({ tmn_code: tmnCode }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 15000
      }
    );

    const bankList = Array.isArray(response.data) ? response.data : response.data?.value;
    return {
      ok: Array.isArray(bankList) && bankList.length > 0,
      detail: Array.isArray(bankList)
        ? `Sandbox nhan dien TMNCODE, tra ve ${bankList.length} ngan hang.`
        : 'Sandbox khong tra ve danh sach ngan hang nhu mong doi.'
    };
  } catch (error) {
    return {
      ok: false,
      detail: error.response?.data?.message || error.message
    };
  }
}

async function main() {
  const tmnCode = String(process.env.VNPAY_TMNCODE || '').trim();
  const secret = String(process.env.VNPAY_HASHSECRET || '').trim();
  const gatewayUrl = String(process.env.VNPAY_URL || '').trim();
  const serverUrl = String(process.env.SERVER_URL || 'http://127.0.0.1:5000').trim().replace(/\/$/, '');
  const configuredReturnUrl = String(process.env.VNPAY_RETURN_URL || '').trim();
  const returnUrl = configuredReturnUrl || `${serverUrl}/api/v1/payments/vnpay-return`;
  const hashMode = PaymentGateway.getVNPayRequestHashMode();
  const envHasTrailingSpaces = [
    ['VNPAY_TMNCODE', process.env.VNPAY_TMNCODE],
    ['VNPAY_HASHSECRET', process.env.VNPAY_HASHSECRET],
    ['VNPAY_URL', process.env.VNPAY_URL],
    ['VNPAY_RETURN_URL', process.env.VNPAY_RETURN_URL]
  ].filter(([, value]) => typeof value === 'string' && value !== value.trim());

  const sampleData = {
    transactionRef: `CHECK${Date.now()}`,
    orderCode: `ORD${Date.now()}`,
    totalAmount: 10000,
    orderInfo: 'Thanh toan don hang kiem tra',
    ipAddress: '127.0.0.1',
    returnUrl
  };

  const requestData = PaymentGateway.generateVNPayRequestData(sampleData);
  const paymentUrl = requestData.paymentUrl;
  const parsedUrl = new URL(paymentUrl);
  const params = {};
  parsedUrl.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const paramsWithoutHash = { ...params };
  const secureHash = paramsWithoutHash.vnp_SecureHash;
  delete paramsWithoutHash.vnp_SecureHash;
  delete paramsWithoutHash.vnp_SecureHashType;

  const repoHashData = requestData.signData || PaymentGateway.buildVNPayHashData(paramsWithoutHash, hashMode);
  const independentHashData = hashMode === 'raw'
    ? buildIndependentRawHashData(paramsWithoutHash)
    : buildIndependentHashData(paramsWithoutHash);
  const independentHash = crypto
    .createHmac('sha512', secret)
    .update(Buffer.from(independentHashData, 'utf-8'))
    .digest('hex');

  const missingParams = REQUIRED_PARAMS.filter((key) => !params[key]);
  const warnings = [];

  if (!isPublicUrl(returnUrl)) {
    warnings.push('vnp_ReturnUrl dang la local/private URL. Neu merchant sandbox da dang ky domain/ReturnUrl cu the, hay doi sang HTTPS public bang ngrok hoac domain that.');
  }

  if (!/^[A-Za-z0-9]{8}$/.test(tmnCode)) {
    warnings.push('VNPAY_TMNCODE khong dung dinh dang 8 ky tu alphanumeric.');
  }

  if (!/^[A-Za-z0-9]+$/.test(params.vnp_TxnRef || '')) {
    warnings.push('vnp_TxnRef nen chi dung ky tu chu va so.');
  }

  if (!/^\d+$/.test(params.vnp_Amount || '')) {
    warnings.push('vnp_Amount phai la chu so va da nhan 100.');
  }

  if (!/^\d{14}$/.test(params.vnp_CreateDate || '')) {
    warnings.push('vnp_CreateDate khong dung dinh dang yyyyMMddHHmmss.');
  }

  if (!/^\d{14}$/.test(params.vnp_ExpireDate || '')) {
    warnings.push('vnp_ExpireDate khong dung dinh dang yyyyMMddHHmmss.');
  }

  console.log('=== VNPAY QUICK CHECK ===');
  console.log(formatCheck('VNPAY_TMNCODE', Boolean(tmnCode), tmnCode || 'missing'));
  console.log(formatCheck('VNPAY_HASHSECRET', Boolean(secret), maskSecret(secret)));
  console.log(formatCheck('Hash algorithm', true, 'sha512'));
  console.log(formatCheck('Hash mode', true, hashMode));
  console.log(formatCheck('VNPAY_URL', /^https:\/\/sandbox\.vnpayment\.vn\/paymentv2\/vpcpay\.html$/i.test(gatewayUrl), gatewayUrl || 'missing'));
  console.log(formatCheck('vnp_ReturnUrl', Boolean(returnUrl), returnUrl));
  console.log(formatCheck('VNPAY_RETURN_URL explicit', Boolean(configuredReturnUrl), configuredReturnUrl || 'not set'));
  console.log(formatCheck('Env whitespace', envHasTrailingSpaces.length === 0, envHasTrailingSpaces.length === 0 ? 'Khong co space thua.' : envHasTrailingSpaces.map(([name]) => name).join(', ')));
  console.log(formatCheck('Required params', missingParams.length === 0, missingParams.length === 0 ? 'Du tham so bat buoc.' : `Thieu: ${missingParams.join(', ')}`));
  console.log(formatCheck('Repo hashData', Boolean(repoHashData), repoHashData));
  console.log(formatCheck('Repo secure hash', requestData.secureHash === secureHash, secureHash));
  console.log(formatCheck('Independent hash matches', independentHash === secureHash, independentHash === secureHash ? 'Chu ky tao ra trung nhau.' : 'Chu ky tu tinh doc lap khong trung.'));

  const merchantCheck = await checkMerchantCode(tmnCode);
  console.log(formatCheck('Sandbox merchant lookup', merchantCheck.ok, merchantCheck.detail));

  console.log('\n=== CURRENT REQUEST PARAMS ===');
  console.log(JSON.stringify(params, null, 2));

  console.log('\n=== CHECKLIST ===');
  console.log(`- HASHSECRET dang duoc doc: ${Boolean(secret) ? 'CO' : 'KHONG'} (khong the tu xac nhan co khop merchant hay khong chi bang code)`);
  console.log('- Co dung sha512 khong: CO');
  console.log('- Params da sort alphabet chua: CO');
  console.log(`- Co encode truoc khi hash khong: ${hashMode === 'raw' ? 'KHONG' : 'CO'}`);
  console.log(`- Amount da nhan 100 chua: ${Number(params.vnp_Amount || 0) % 100 === 0 ? 'CO' : 'KHONG'}`);
  console.log(`- Co them param sau khi hash khong: ${requestData.paymentUrl.endsWith(`vnp_SecureHash=${requestData.secureHash}`) ? 'KHONG' : 'CO'}`);

  if (warnings.length > 0) {
    console.log('\n=== WARNINGS ===');
    warnings.forEach((warning, index) => {
      console.log(`${index + 1}. ${warning}`);
    });
  }

  console.log('\n=== NEXT ACTIONS ===');
  if (independentHash !== secureHash) {
    console.log('1. Loi nam o code tao chu ky. Khong nen test gateway truoc khi sua xong hash.');
    process.exitCode = 1;
    return;
  }

  if (!merchantCheck.ok) {
    console.log('1. TMNCODE khong duoc sandbox nhan dien. Kiem tra lai ma merchant hoac moi truong sandbox/prod.');
    process.exitCode = 1;
    return;
  }

  console.log('1. Neu van code=70, kha nang cao HASHSECRET khong khop voi TMNCODE nay.');
  console.log('2. Neu merchant sandbox dang rang buoc ReturnUrl/IPN, hay doi sang HTTPS public va cap nhat lai phia VNPAY.');
  console.log('3. Chay lai lenh nay sau moi lan doi env: npm run check:vnpay');
}

main().catch((error) => {
  console.error('[FAIL] VNPAY quick check:', error.message);
  process.exit(1);
});