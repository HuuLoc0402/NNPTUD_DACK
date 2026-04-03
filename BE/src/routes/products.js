const express = require('express');
const jwt = require('jsonwebtoken');
const Product = require('../models/Product');
const productController = require('../controllers/productController');
const { authenticate, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  PRODUCT_SIZE_ENUM,
  buildVariantSkuSeed,
  dedupeColorOptions,
  normalizeColorCode,
  normalizeColorName,
  normalizeProductImages
} = require('../utils/productVariant');

const router = express.Router();

const toSlug = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const buildUniqueSlug = async (name, excludeProductId = null) => {
  const baseSlug = toSlug(name) || 'san-pham';
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existingProduct = await Product.findOne({ slug }).select('_id').lean();
    if (!existingProduct || String(existingProduct._id) === String(excludeProductId)) {
      return slug;
    }

    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }
};

const buildUniqueVariantSku = async (sku, excludeProductId = null) => {
  const baseSku = String(sku || '').trim();
  if (!baseSku) {
    return undefined;
  }

  let candidateSku = baseSku;
  let counter = 1;

  while (true) {
    const existingProduct = await Product.findOne({ 'variants.sku': candidateSku }).select('_id').lean();
    if (!existingProduct || String(existingProduct._id) === String(excludeProductId)) {
      return candidateSku;
    }

    counter += 1;
    candidateSku = `${baseSku}-${counter}`;
  }
};

const parseJsonField = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

const toNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return String(value).toLowerCase() === 'true';
};

const normalizeLegacyColors = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeColorName(item)).filter(Boolean);
  }

  return String(value || '')
    .split(',')
    .map((item) => normalizeColorName(item))
    .filter(Boolean);
};

const normalizeGalleryEntries = ({ req, existingProduct }) => {
  const existingImages = normalizeProductImages(existingProduct);
  const galleryEntries = parseJsonField(req.body.galleryEntries, null);
  const galleryFiles = req.files?.galleryImages || [];
  const legacyImageFile = req.files?.image?.[0] || null;

  if (Array.isArray(galleryEntries) && galleryEntries.length > 0) {
    const mappedEntries = galleryEntries
      .map((entry, index) => {
        const uploadIndex = Number(entry?.uploadIndex);
        const uploadFile = Number.isInteger(uploadIndex) ? galleryFiles[uploadIndex] : null;
        const url = uploadFile
          ? `/uploads/${uploadFile.filename}`
          : String(entry?.url || '').trim();

        if (!url) {
          return null;
        }

        return {
          url,
          color: entry?.color ? normalizeColorName(entry.color) : null,
          alt: String(entry?.alt || '').trim(),
          isPrimary: toBoolean(entry?.isPrimary, false) || index === 0
        };
      })
      .filter(Boolean);

    if (mappedEntries.length > 0) {
      const hasPrimary = mappedEntries.some((item) => item.isPrimary);
      if (!hasPrimary) {
        mappedEntries[0].isPrimary = true;
      }

      return mappedEntries.map((item, index) => ({
        ...item,
        isPrimary: item.isPrimary || index === 0
      }));
    }
  }

  if (galleryFiles.length > 0) {
    return galleryFiles.map((file, index) => ({
      url: `/uploads/${file.filename}`,
      color: null,
      alt: '',
      isPrimary: index === 0
    }));
  }

  if (legacyImageFile) {
    return [{
      url: `/uploads/${legacyImageFile.filename}`,
      color: null,
      alt: '',
      isPrimary: true
    }];
  }

  return existingImages;
};

const normalizeLegacyVariants = (req, existingProduct = null) => {
  const existingVariant = existingProduct?.variants?.[0] || {};
  const size = req.body.size || existingVariant.size || 'M';
  const colorName = normalizeLegacyColors(req.body.color || existingVariant.color || existingProduct?.color || 'Mac dinh')[0] || 'Mac dinh';
  const price = toNumber(req.body.price ?? existingVariant.price ?? existingProduct?.price, 0);
  const stock = toNumber(req.body.quantity ?? existingVariant.stock ?? existingProduct?.quantity, 0);
  const sku = req.body.sku || existingVariant.sku || null;

  return [{
    size,
    color: colorName,
    colorCode: normalizeColorCode(existingVariant.colorCode, colorName),
    price,
    stock,
    sku
  }];
};

const normalizeVariantsInput = (rawVariants = []) => {
  if (!Array.isArray(rawVariants) || rawVariants.length === 0) {
    return [];
  }

  return rawVariants
    .map((variant) => ({
      size: String(variant?.size || '').trim(),
      color: normalizeColorName(variant?.color),
      colorCode: normalizeColorCode(variant?.colorCode, variant?.color),
      price: toNumber(variant?.price, 0),
      stock: Math.max(0, toNumber(variant?.stock, 0)),
      sku: String(variant?.sku || '').trim() || null
    }))
    .filter((variant) => variant.size && PRODUCT_SIZE_ENUM.includes(variant.size));
};

const ensureUniqueVariantKeys = (variants) => {
  const seen = new Set();
  for (const variant of variants) {
    const key = `${variant.color}__${variant.size}`;
    if (seen.has(key)) {
      throw new Error(`Biến thể ${variant.color} / ${variant.size} đang bị trùng`);
    }
    seen.add(key);
  }
};

const assignVariantSkus = async ({ name, variants, excludeProductId }) => {
  const usedSkus = new Set();

  for (const variant of variants) {
    const preferredSku = variant.sku || buildVariantSkuSeed({
      name,
      color: variant.color,
      size: variant.size
    });
    let candidate = preferredSku;
    let counter = 1;

    while (usedSkus.has(candidate)) {
      counter += 1;
      candidate = `${preferredSku}-${counter}`;
    }

    candidate = await buildUniqueVariantSku(candidate, excludeProductId);
    usedSkus.add(candidate);
    variant.sku = candidate;
  }

  return variants;
};

const getViewerRole = (req) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }

  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    return decoded.role || null;
  } catch (error) {
    return null;
  }
};

const buildProductPayload = async (req, existingProduct = null) => {
  const productName = req.body.name ?? existingProduct?.name;
  const discountValue = toNumber(req.body.discount ?? existingProduct?.discount, 0);
  const slugValue = req.body.name
    ? await buildUniqueSlug(req.body.name, existingProduct?._id)
    : existingProduct?.slug;
  const galleryEntries = normalizeGalleryEntries({ req, existingProduct });
  const rawVariants = parseJsonField(req.body.variants, null);
  const variants = normalizeVariantsInput(rawVariants);
  const normalizedVariants = variants.length > 0
    ? variants
    : normalizeLegacyVariants(req, existingProduct);

  ensureUniqueVariantKeys(normalizedVariants);
  await assignVariantSkus({
    name: productName,
    variants: normalizedVariants,
    excludeProductId: existingProduct?._id
  });

  const totalQuantity = normalizedVariants.reduce((sum, item) => sum + Math.max(0, toNumber(item.stock, 0)), 0);
  const priceValues = normalizedVariants.map((item) => toNumber(item.price, 0));
  const basePrice = priceValues.length > 0 ? Math.min(...priceValues) : toNumber(existingProduct?.price, 0);
  const colorOptions = dedupeColorOptions([
    ...normalizedVariants.map((item) => ({ name: item.color, code: item.colorCode })),
    ...galleryEntries.filter((item) => item.color).map((item) => ({ name: item.color }))
  ]);
  const primaryImage = galleryEntries.find((item) => item.isPrimary)?.url || galleryEntries[0]?.url || null;

  return {
    name: productName,
    slug: slugValue,
    description: req.body.description ?? existingProduct?.description,
    category: req.body.category ?? existingProduct?.category,
    price: basePrice,
    discount: discountValue,
    quantity: totalQuantity,
    image: primaryImage,
    images: galleryEntries,
    variants: normalizedVariants,
    color: colorOptions.map((item) => item.name),
    colorOptions,
    isActive: req.body.isActive === undefined
      ? existingProduct?.isActive ?? true
      : req.body.isActive === 'true' || req.body.isActive === true,
    isFeatured: req.body.isFeatured === undefined
      ? existingProduct?.isFeatured ?? false
      : req.body.isFeatured === 'true' || req.body.isFeatured === true
  };
};

router.get('/featured', async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 10);
    const products = await Product.find({ isActive: true, isFeatured: true })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('category', 'name slug');

    return res.status(200).json({
      success: true,
      data: products.map((item) => productController.formatProduct(item, true))
    });
  } catch (error) {
    next(error);
  }
});

router.get('/top-rated', async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 10);
    const products = await Product.find({ isActive: true })
      .sort({ ratingAverage: -1, commentCount: -1 })
      .limit(limit)
      .populate('category', 'name slug');

    return res.status(200).json({
      success: true,
      data: products.map((item) => productController.formatProduct(item, true))
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 100);
    const skip = (page - 1) * limit;
    const filter = {};

    if (req.query.category) {
      filter.category = req.query.category;
    }

    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    if (req.query.minPrice || req.query.maxPrice) {
      filter.price = {};
      if (req.query.minPrice) filter.price.$gte = Number(req.query.minPrice);
      if (req.query.maxPrice) filter.price.$lte = Number(req.query.maxPrice);
    }

    const sort = {};
    if (req.query.sort === 'price-asc') sort.price = 1;
    else if (req.query.sort === 'price-desc') sort.price = -1;
    else if (req.query.sort === 'rating') sort.ratingAverage = -1;
    else if (req.query.sort === 'popular') sort.views = -1;
    else sort.createdAt = -1;

    const products = await Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('category', 'name slug');

    const adminView = getViewerRole(req) === 'admin';
    return res.status(200).json({
      success: true,
      data: products.map((item) => productController.formatProduct(item, !adminView))
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const product = await productController.findProductBySlug(req.params.slug)
      || await productController.findProductById(req.params.slug);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.views = (product.views || 0) + 1;
    await product.save();

    return res.status(200).json({
      success: true,
      data: productController.formatProduct(product, true)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, adminOnly, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'galleryImages', maxCount: 20 }
]), async (req, res, next) => {
  try {
    const payload = await buildProductPayload(req);
    const product = await productController.createProduct(payload);
    const populatedProduct = await productController.findProductById(product._id);

    return res.status(201).json({
      success: true,
      data: productController.formatProduct(populatedProduct, false)
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, adminOnly, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'galleryImages', maxCount: 20 }
]), async (req, res, next) => {
  try {
    const existingProduct = await productController.findProductById(req.params.id);
    if (!existingProduct) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const payload = await buildProductPayload(req, existingProduct);
    const product = await productController.updateProduct(req.params.id, payload);

    return res.status(200).json({
      success: true,
      data: productController.formatProduct(product, false)
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, adminOnly, async (req, res, next) => {
  try {
    const product = await productController.deleteProduct(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    return res.status(200).json({ success: true, data: productController.formatProduct(product, false) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;