const Product = require('../models/Product');

const normalizeImages = (product) => {
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images.map((item) => (typeof item === 'string' ? item : item.url)).filter(Boolean);
  }

  return product.image ? [product.image] : [];
};

const getCategoryValue = (category, detailView) => {
  if (!category) {
    return null;
  }

  if (typeof category === 'object' && category._id) {
    return detailView ? String(category._id) : {
      _id: String(category._id),
      name: category.name,
      slug: category.slug
    };
  }

  return String(category);
};

exports.createProduct = (payload) => {
  const product = new Product(payload);
  return product.save();
};

exports.findProducts = (filter = {}) => {
  return Product.find(filter).populate('category', 'name slug');
};

exports.findProductById = (productId) => {
  return Product.findById(productId).populate('category', 'name slug');
};

exports.findProductBySlug = (slug) => {
  return Product.findOne({ slug, isActive: true }).populate('category', 'name slug');
};

exports.updateProduct = (productId, updateData) => {
  return Product.findByIdAndUpdate(productId, updateData, {
    new: true,
    runValidators: true
  }).populate('category', 'name slug');
};

exports.deleteProduct = (productId) => {
  return Product.findByIdAndDelete(productId);
};

exports.formatProduct = (productDoc, detailView = false) => {
  const product = productDoc.toObject ? productDoc.toObject() : productDoc;
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const sizes = variants.map((item) => item.size).filter(Boolean);
  const stock = variants.length > 0
    ? variants.reduce((total, item) => total + (item.stock || 0), 0)
    : product.quantity || 0;

  return {
    ...product,
    category: getCategoryValue(product.category, detailView),
    categoryId: typeof product.category === 'object' && product.category?._id
      ? String(product.category._id)
      : product.category
        ? String(product.category)
        : null,
    currentPrice: product.finalPrice || product.price,
    images: normalizeImages(product),
    colors: product.color || [],
    sizes,
    stock,
    sku: variants[0]?.sku || null,
    rating: product.ratingAverage || 0,
    reviews: Array.from({ length: product.commentCount || 0 })
  };
};