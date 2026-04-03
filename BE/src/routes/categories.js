const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Category = require('../models/Category');
const categoryController = require('../controllers/categoryController');
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

const buildUniqueSlug = async (name, excludeCategoryId = null) => {
  const baseSlug = toSlug(name) || 'danh-muc';
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existingCategory = await Category.findOne({ slug }).select('_id').lean();
    if (!existingCategory || String(existingCategory._id) === String(excludeCategoryId)) {
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

router.get('/', async (req, res, next) => {
  try {
    const categories = await categoryController.findCategories(
      getViewerRole(req) === 'admin' ? {} : { isActive: true }
    );
    return res.status(200).json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
});

router.get('/:identifier', async (req, res, next) => {
  try {
    const { identifier } = req.params;
    let category = await categoryController.findCategoryBySlug(identifier);

    if (!category && mongoose.Types.ObjectId.isValid(identifier)) {
      category = await categoryController.findCategoryById(identifier);
    }

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    return res.status(200).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, adminOnly, upload.single('image'), async (req, res, next) => {
  try {
    const payload = {
      name: req.body.name,
      slug: await buildUniqueSlug(req.body.name),
      description: req.body.description || '',
      image: req.file ? `/uploads/${req.file.filename}` : null,
      isActive: req.body.isActive === undefined ? true : req.body.isActive === 'true' || req.body.isActive === true,
      displayOrder: Number(req.body.displayOrder || 0),
      parent: req.body.parent || null
    };

    const category = await categoryController.createCategory(payload);
    return res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, adminOnly, upload.single('image'), async (req, res, next) => {
  try {
    const existingCategory = await categoryController.findCategoryById(req.params.id);
    if (!existingCategory) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const updateData = {
      name: req.body.name ?? existingCategory.name,
      slug: req.body.name ? await buildUniqueSlug(req.body.name, existingCategory._id) : existingCategory.slug,
      description: req.body.description ?? existingCategory.description,
      isActive: req.body.isActive === undefined
        ? existingCategory.isActive
        : req.body.isActive === 'true' || req.body.isActive === true,
      displayOrder: req.body.displayOrder === undefined ? existingCategory.displayOrder : Number(req.body.displayOrder),
      parent: req.body.parent === undefined ? existingCategory.parent : (req.body.parent || null)
    };

    if (req.file) {
      updateData.image = `/uploads/${req.file.filename}`;
    }

    const category = await categoryController.updateCategory(req.params.id, updateData);
    return res.status(200).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, adminOnly, async (req, res, next) => {
  try {
    const products = await productController.findProducts({ category: req.params.id });
    if (products.length > 0) {
      return res.status(400).json({ success: false, message: 'Không thể xóa danh mục đang có sản phẩm' });
    }

    const category = await categoryController.deleteCategory(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    return res.status(200).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
});

module.exports = router;