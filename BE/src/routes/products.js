const express = require('express');
const jwt = require('jsonwebtoken');
const Product = require('../models/Product');
const productController = require('../controllers/productController');
const { authenticate, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

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
  const imagePath = req.file
    ? `/uploads/${req.file.filename}`
    : req.body.image || existingProduct?.image || null;
  const sizeValue = req.body.size || existingProduct?.variants?.[0]?.size || 'M';
  const rawSkuValue = req.body.sku ?? existingProduct?.variants?.[0]?.sku;
  const priceValue = Number(req.body.price ?? existingProduct?.price ?? 0);
  const quantityValue = Number(req.body.quantity ?? existingProduct?.quantity ?? 0);
  const discountValue = Number(req.body.discount ?? existingProduct?.discount ?? 0);
  const colorValues = req.body.color
    ? String(req.body.color).split(',').map((item) => item.trim()).filter(Boolean)
    : existingProduct?.color || [];
  const slugValue = req.body.name
    ? await buildUniqueSlug(req.body.name, existingProduct?._id)
    : existingProduct?.slug;
  const skuValue = await buildUniqueVariantSku(rawSkuValue, existingProduct?._id);

  return {
    name: req.body.name ?? existingProduct?.name,
    slug: slugValue,
    description: req.body.description ?? existingProduct?.description,
    category: req.body.category ?? existingProduct?.category,
    price: priceValue,
    discount: discountValue,
    quantity: quantityValue,
    image: imagePath,
    images: imagePath ? [{ url: imagePath }] : existingProduct?.images || [],
    variants: [{
      size: sizeValue,
      price: priceValue,
      stock: quantityValue,
      sku: skuValue
    }],
    color: colorValues,
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

router.post('/', authenticate, adminOnly, upload.single('image'), async (req, res, next) => {
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

router.put('/:id', authenticate, adminOnly, upload.single('image'), async (req, res, next) => {
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