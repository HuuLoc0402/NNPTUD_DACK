const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Collection = require('../models/Collection');
const Product = require('../models/Product');
const collectionController = require('../controllers/collectionController');
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

const buildUniqueSlug = async (name, excludeCollectionId = null) => {
  const baseSlug = toSlug(name) || 'bo-suu-tap';
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existingCollection = await Collection.findOne({ slug }).select('_id').lean();
    if (!existingCollection || String(existingCollection._id) === String(excludeCollectionId)) {
      return slug;
    }

    counter += 1;
    slug = `${baseSlug}-${counter}`;
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

const parseProductIds = (value) => {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) {
    throw new Error('Danh sách sản phẩm của collection không hợp lệ');
  }

  return Array.from(new Set(parsed.map((item) => String(item || '').trim()).filter(Boolean)));
};

const validateProductIds = async (productIds) => {
  const invalidIds = productIds.filter((id) => !mongoose.Types.ObjectId.isValid(id));
  if (invalidIds.length) {
    throw new Error('Danh sách sản phẩm có ID không hợp lệ');
  }

  const products = await Product.find({ _id: { $in: productIds } }).select('_id isActive').lean();
  if (products.length !== productIds.length) {
    throw new Error('Một hoặc nhiều sản phẩm trong collection không tồn tại');
  }

  return productIds;
};

router.get('/', async (req, res, next) => {
  try {
    const adminView = getViewerRole(req) === 'admin';
    const filter = adminView ? {} : { isActive: true };

    if (req.query.featured === 'true') {
      filter.isFeatured = true;
    }

    const collections = await collectionController.findCollections(filter);
    const limitedCollections = Number(req.query.limit || 0) > 0
      ? collections.slice(0, Number(req.query.limit))
      : collections;

    return res.status(200).json({
      success: true,
      data: limitedCollections.map((collection) => collectionController.formatCollection(collection, { adminView }))
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:identifier', async (req, res, next) => {
  try {
    const adminView = getViewerRole(req) === 'admin';
    const { identifier } = req.params;
    let collection = await collectionController.findCollectionBySlug(identifier);

    if (!collection && mongoose.Types.ObjectId.isValid(identifier)) {
      collection = await collectionController.findCollectionById(identifier);
    }

    if (!collection || (!adminView && collection.isActive === false)) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    const orderedProducts = Array.isArray(collection.products)
      ? collection.products.filter(Boolean)
      : [];

    const normalizedCollection = {
      ...(collection.toObject ? collection.toObject() : collection),
      products: orderedProducts
    };

    return res.status(200).json({
      success: true,
      data: collectionController.formatCollection(normalizedCollection, { includeProducts: true, adminView })
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, adminOnly, upload.single('image'), async (req, res, next) => {
  try {
    const productIds = await validateProductIds(parseProductIds(req.body.productIds));
    const collection = await collectionController.createCollection({
      name: req.body.name,
      slug: await buildUniqueSlug(req.body.name),
      description: req.body.description || '',
      image: req.file ? `/uploads/${req.file.filename}` : null,
      products: productIds,
      isActive: req.body.isActive === undefined ? true : req.body.isActive === 'true' || req.body.isActive === true,
      isFeatured: req.body.isFeatured === undefined ? false : req.body.isFeatured === 'true' || req.body.isFeatured === true,
      displayOrder: Number(req.body.displayOrder || 0)
    });

    const populatedCollection = await collectionController.findCollectionById(collection._id);
    return res.status(201).json({
      success: true,
      data: collectionController.formatCollection(populatedCollection, { includeProducts: true, adminView: true })
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, adminOnly, upload.single('image'), async (req, res, next) => {
  try {
    const existingCollection = await collectionController.findCollectionById(req.params.id);
    if (!existingCollection) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    const productIds = req.body.productIds === undefined
      ? existingCollection.products.map((product) => String(product._id || product))
      : await validateProductIds(parseProductIds(req.body.productIds));

    const updateData = {
      name: req.body.name ?? existingCollection.name,
      slug: req.body.name ? await buildUniqueSlug(req.body.name, existingCollection._id) : existingCollection.slug,
      description: req.body.description ?? existingCollection.description,
      products: productIds,
      isActive: req.body.isActive === undefined
        ? existingCollection.isActive
        : req.body.isActive === 'true' || req.body.isActive === true,
      isFeatured: req.body.isFeatured === undefined
        ? existingCollection.isFeatured
        : req.body.isFeatured === 'true' || req.body.isFeatured === true,
      displayOrder: req.body.displayOrder === undefined ? existingCollection.displayOrder : Number(req.body.displayOrder)
    };

    if (req.file) {
      updateData.image = `/uploads/${req.file.filename}`;
    }

    const updatedCollection = await collectionController.updateCollection(req.params.id, updateData);
    return res.status(200).json({
      success: true,
      data: collectionController.formatCollection(updatedCollection, { includeProducts: true, adminView: true })
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, adminOnly, async (req, res, next) => {
  try {
    const collection = await collectionController.deleteCollection(req.params.id);
    if (!collection) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    return res.status(200).json({ success: true, data: collection });
  } catch (error) {
    next(error);
  }
});

module.exports = router;