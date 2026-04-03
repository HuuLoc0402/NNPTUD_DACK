const express = require('express');
const Product = require('../models/Product');
const Wishlist = require('../models/Wishlist');
const productController = require('../controllers/productController');
const { authenticate } = require('../middleware/auth');
const { findMatchingVariant, getImagesForColor, normalizeColorName } = require('../utils/productVariant');

const router = express.Router();

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeWishlistPayload = (body = {}) => ({
  productId: body.productId || body.product,
  size: String(body.size || 'M').trim() || 'M',
  color: normalizeColorName(body.color || 'Mac dinh'),
  nameSnapshot: String(body.name || '').trim(),
  slugSnapshot: String(body.slug || '').trim(),
  imageSnapshot: String(body.image || '').trim(),
  priceSnapshot: toNumber(body.price, 0),
  originalPriceSnapshot: toNumber(body.originalPrice ?? body.price, 0)
});

const findOrCreateWishlist = async (userId) => {
  const wishlist = await Wishlist.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, items: [] } },
    { new: true, upsert: true }
  );

  return wishlist;
};

const formatWishlistItem = (entry) => {
  if (!entry?.product) {
    return null;
  }

  const formattedProduct = productController.formatProduct(entry.product, true);
  const variant = findMatchingVariant(formattedProduct, {
    size: entry.size,
    color: entry.color
  });
  const image = getImagesForColor(formattedProduct, entry.color)[0]?.url
    || formattedProduct.image
    || entry.imageSnapshot
    || null;
  const price = toNumber(
    variant?.finalPrice
      ?? formattedProduct.minCurrentPrice
      ?? entry.priceSnapshot,
    0
  );
  const originalPrice = toNumber(
    variant?.price
      ?? formattedProduct.minPrice
      ?? entry.originalPriceSnapshot
      ?? price,
    price
  );

  return {
    productId: String(formattedProduct._id),
    slug: formattedProduct.slug || entry.slugSnapshot || String(formattedProduct._id),
    name: formattedProduct.name || entry.nameSnapshot || 'San pham',
    image,
    price,
    originalPrice,
    size: entry.size || variant?.size || formattedProduct.defaultVariant?.size || 'M',
    color: normalizeColorName(entry.color || variant?.color || formattedProduct.defaultVariant?.color),
    addedAt: entry.addedAt || new Date().toISOString()
  };
};

const getFormattedWishlist = async (userId) => {
  const wishlist = await findOrCreateWishlist(userId);
  await wishlist.populate({
    path: 'items.product',
    select: 'name slug image images price discount color colorOptions variants quantity finalPrice isActive'
  });

  const validItems = wishlist.items.filter((item) => item.product);
  if (validItems.length !== wishlist.items.length) {
    wishlist.items = validItems;
    await wishlist.save();
  }

  return wishlist.items.map(formatWishlistItem).filter(Boolean);
};

router.get('/', authenticate, async (req, res, next) => {
  try {
    const items = await getFormattedWishlist(req.userId);
    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
});

router.post('/items', authenticate, async (req, res, next) => {
  try {
    const payload = normalizeWishlistPayload(req.body);
    if (!payload.productId) {
      return res.status(400).json({ success: false, message: 'Thiếu productId' });
    }

    const product = await Product.findById(payload.productId).select('_id name slug image images price discount color colorOptions variants quantity finalPrice isActive');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    }

    const wishlist = await findOrCreateWishlist(req.userId);
    const existingIndex = wishlist.items.findIndex((item) => String(item.product) === String(product._id));
    const nextItem = {
      product: product._id,
      size: payload.size,
      color: payload.color,
      nameSnapshot: payload.nameSnapshot || product.name || '',
      slugSnapshot: payload.slugSnapshot || product.slug || String(product._id),
      imageSnapshot: payload.imageSnapshot || product.image || '',
      priceSnapshot: payload.priceSnapshot,
      originalPriceSnapshot: payload.originalPriceSnapshot,
      addedAt: new Date()
    };

    if (existingIndex >= 0) {
      wishlist.items.splice(existingIndex, 1);
    }

    wishlist.items.unshift(nextItem);
    await wishlist.save();

    return res.status(200).json({ success: true, data: await getFormattedWishlist(req.userId) });
  } catch (error) {
    next(error);
  }
});

router.post('/sync', authenticate, async (req, res, next) => {
  try {
    const inputItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!inputItems.length) {
      return res.status(200).json({ success: true, data: await getFormattedWishlist(req.userId) });
    }

    const wishlist = await findOrCreateWishlist(req.userId);
    const seen = new Set(wishlist.items.map((item) => String(item.product)));

    for (const rawItem of inputItems) {
      const payload = normalizeWishlistPayload(rawItem);
      if (!payload.productId || seen.has(String(payload.productId))) {
        continue;
      }

      const product = await Product.findById(payload.productId).select('_id name slug image');
      if (!product) {
        continue;
      }

      wishlist.items.unshift({
        product: product._id,
        size: payload.size,
        color: payload.color,
        nameSnapshot: payload.nameSnapshot || product.name || '',
        slugSnapshot: payload.slugSnapshot || product.slug || String(product._id),
        imageSnapshot: payload.imageSnapshot || product.image || '',
        priceSnapshot: payload.priceSnapshot,
        originalPriceSnapshot: payload.originalPriceSnapshot,
        addedAt: rawItem?.addedAt || new Date()
      });
      seen.add(String(product._id));
    }

    await wishlist.save();
    return res.status(200).json({ success: true, data: await getFormattedWishlist(req.userId) });
  } catch (error) {
    next(error);
  }
});

router.delete('/items/:productId', authenticate, async (req, res, next) => {
  try {
    const wishlist = await findOrCreateWishlist(req.userId);
    wishlist.items = wishlist.items.filter((item) => String(item.product) !== String(req.params.productId));
    await wishlist.save();

    return res.status(200).json({ success: true, data: await getFormattedWishlist(req.userId) });
  } catch (error) {
    next(error);
  }
});

router.delete('/clear', authenticate, async (req, res, next) => {
  try {
    const wishlist = await findOrCreateWishlist(req.userId);
    wishlist.items = [];
    await wishlist.save();

    return res.status(200).json({ success: true, data: [] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;