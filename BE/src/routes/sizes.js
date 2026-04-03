const express = require('express');
const Size = require('../models/Size');
const { authenticate, adminOnly } = require('../middleware/auth');

const router = express.Router();

const SIZE_META_MAP = new Map(
  Size.DEFAULT_SIZE_GUIDE.map((entry, index) => [entry.name, {
    code: entry.code || entry.name,
    displayOrder: Number(entry.displayOrder || index + 1)
  }])
);

const ensureDefaultSizeGuide = async () => {
  const count = await Size.countDocuments();
  if (count === 0) {
    await Size.insertMany(Size.DEFAULT_SIZE_GUIDE.map((entry) => ({
      ...entry,
      isActive: true
    })));
  }
};

const normalizeNames = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const formatSizeRow = (size) => ({
  _id: String(size._id),
  name: size.name,
  code: size.code,
  displayOrder: size.displayOrder || 0,
  usSize: size.usSize || '-',
  euSize: size.euSize || '-',
  height: size.height || '-',
  weight: size.weight || '-',
  chest: size.chest || '-',
  waist: size.waist || '-',
  hip: size.hip || '-',
  isActive: size.isActive !== false,
  fitNote: size.fitNote || ''
});

const getSizeSortValue = (size) => {
  const fallbackOrder = SIZE_META_MAP.get(size.name)?.displayOrder;
  return Number(size.displayOrder || fallbackOrder || 999);
};

const sortSizesByStandardOrder = (sizes = []) => sizes.sort((left, right) => {
  const leftOrder = getSizeSortValue(left);
  const rightOrder = getSizeSortValue(right);

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return String(left.name || '').localeCompare(String(right.name || ''));
});

const normalizePayload = (body = {}) => {
  const name = String(body.name || '').trim();
  const defaultMeta = SIZE_META_MAP.get(name) || {};

  return {
    name,
    code: defaultMeta.code || name.replace(/\s+/g, '').toUpperCase(),
    displayOrder: Number(defaultMeta.displayOrder || 999),
    usSize: String(body.usSize || '').trim(),
    euSize: String(body.euSize || '').trim(),
    height: String(body.height || '').trim(),
    weight: String(body.weight || '').trim(),
    chest: String(body.chest || '').trim(),
    waist: String(body.waist || '').trim(),
    hip: String(body.hip || '').trim(),
    fitNote: String(body.fitNote || '').trim(),
    isActive: body.isActive === true || body.isActive === 'true'
  };
};

router.get('/', authenticate, adminOnly, async (req, res, next) => {
  try {
    await ensureDefaultSizeGuide();
    const sizes = sortSizesByStandardOrder(await Size.find({}));
    return res.status(200).json({
      success: true,
      data: sizes.map(formatSizeRow)
    });
  } catch (error) {
    next(error);
  }
});

router.get('/chart', async (req, res, next) => {
  try {
    await ensureDefaultSizeGuide();
    const names = normalizeNames(req.query.names);
    const filter = { isActive: true };

    if (names.length > 0) {
      filter.name = { $in: names };
    }

    const sizes = sortSizesByStandardOrder(await Size.find(filter));
    return res.status(200).json({
      success: true,
      data: sizes.map(formatSizeRow),
      meta: {
        note: 'Bảng kích thước tham khảo, số đo có thể chênh lệch khoảng 1-2 cm tùy chất liệu và form sản phẩm.'
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, adminOnly, async (req, res, next) => {
  try {
    const payload = normalizePayload(req.body);
    if (!payload.name) {
      return res.status(400).json({ success: false, message: 'Tên size là bắt buộc' });
    }

    const size = await Size.create(payload);
    return res.status(201).json({ success: true, data: formatSizeRow(size) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Tên size hoặc mã size đã tồn tại' });
    }
    next(error);
  }
});

router.put('/:id', authenticate, adminOnly, async (req, res, next) => {
  try {
    const payload = normalizePayload(req.body);
    if (!payload.name) {
      return res.status(400).json({ success: false, message: 'Tên size là bắt buộc' });
    }

    const size = await Size.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });

    if (!size) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy size' });
    }

    return res.status(200).json({ success: true, data: formatSizeRow(size) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Tên size hoặc mã size đã tồn tại' });
    }
    next(error);
  }
});

router.delete('/:id', authenticate, adminOnly, async (req, res, next) => {
  try {
    const size = await Size.findByIdAndDelete(req.params.id);
    if (!size) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy size' });
    }

    return res.status(200).json({ success: true, message: 'Đã xóa size thành công' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;