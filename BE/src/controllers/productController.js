const Product = require('../models/Product');
const Category = require('../models/Category');
const { AppError } = require('../middleware/errorHandler');

exports.createProduct = async (req, res, next) => {
  try {
    const { name, description, category, price, discount, quantity, size, color, material, origin, brand } = req.body;
    const image = req.file?.filename || req.body.image;

    // Check if category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check duplicate name
    const existingProduct = await Product.findOne({ name });
    if (existingProduct) {
      return res.status(400).json({ message: 'Product name already exists' });
    }

    // Create slug
    const slug = name.toLowerCase().replace(/\s+/g, '-');

    const product = new Product({
      name,
      slug,
      description,
      category,
      price,
      discount: discount || 0,
      quantity,
      image,
      size: size ? size.split(',').map(s => s.trim()) : [],
      color: color ? color.split(',').map(c => c.trim()) : [],
      material,
      origin,
      brand
    });

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    next(error);
  }
};

exports.getProducts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'newest';
    const search = req.query.search || '';
    const categoryId = req.query.category;

    // Build filter
    const filter = { isActive: true };

    if (search) {
      filter.$text = { $search: search };
    }

    if (categoryId) {
      filter.category = categoryId;
    }

    // Build sort
    let sort = {};
    switch (sortBy) {
      case 'price-asc':
        sort = { finalPrice: 1 };
        break;
      case 'price-desc':
        sort = { finalPrice: -1 };
        break;
      case 'name-asc':
        sort = { name: 1 };
        break;
      case 'name-desc':
        sort = { name: -1 };
        break;
      case 'rating':
        sort = { ratingAverage: -1 };
        break;
      case 'popular':
        sort = { views: -1 };
        break;
      default:
        sort = { createdAt: -1 };
    }

    // Get products
    const products = await Product.find(filter)
      .populate('category', 'name slug')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Get total count
    const total = await Product.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getProduct = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const product = await Product.findOne({ slug, isActive: true })
      .populate('category', 'name slug')
      .populate({
        path: 'comments',
        model: 'Comment',
        match: { isApproved: true },
        populate: { path: 'user', select: 'fullName avatar' }
      });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Increment views
    product.views += 1;
    await product.save();

    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, price, discount, quantity, size, color, material, origin, brand } = req.body;
    const image = req.file?.filename || req.body.image;

    // Check if product exists
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Update fields
    if (name) {
      product.name = name;
      product.slug = name.toLowerCase().replace(/\s+/g, '-');
    }

    if (description) product.description = description;
    if (price) product.price = price;
    if (discount !== undefined) product.discount = discount;
    if (quantity !== undefined) product.quantity = quantity;
    if (image) product.image = image;
    if (size) product.size = size.split(',').map(s => s.trim());
    if (color) product.color = color.split(',').map(c => c.trim());
    if (material) product.material = material;
    if (origin) product.origin = origin;
    if (brand) product.brand = brand;

    await product.save();

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Soft delete
    product.isActive = false;
    await product.save();

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

exports.updateStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    const product = await Product.findByIdAndUpdate(
      id,
      { quantity },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Stock updated successfully',
      product
    });
  } catch (error) {
    next(error);
  }
};

exports.getFeaturedProducts = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const products = await Product.find({ isActive: true, isFeatured: true })
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json({
      success: true,
      data: products
    });
  } catch (error) {
    next(error);
  }
};

exports.getTopRatedProducts = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const products = await Product.find({ isActive: true })
      .populate('category', 'name slug')
      .sort({ ratingAverage: -1 })
      .limit(limit);

    res.status(200).json({
      success: true,
      data: products
    });
  } catch (error) {
    next(error);
  }
};
