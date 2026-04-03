const Product = require('../models/Product');
const Wishlist = require('../models/Wishlist');
const {
  getDefaultVariant,
  getProductColorOptions,
  normalizeColorCode,
  normalizeColorName,
  normalizeProductImages,
  sortSizes
} = require('../utils/productVariant');

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

exports.deleteProduct = async (productId) => {
  const product = await Product.findByIdAndDelete(productId);
  if (!product) {
    return null;
  }

  await Wishlist.updateMany(
    { 'items.product': product._id },
    { $pull: { items: { product: product._id } } }
  );

  return product;
};

exports.formatProduct = (productDoc, detailView = false) => {
  const product = productDoc.toObject ? productDoc.toObject() : productDoc;
  const variants = Array.isArray(product.variants)
    ? product.variants.map((item) => ({
      ...item,
      color: normalizeColorName(item.color),
      colorCode: normalizeColorCode(item.colorCode, item.color),
      finalPrice: Number(item.price || 0) * (1 - Number(product.discount || 0) / 100)
    }))
    : [];
  const sizes = sortSizes(Array.from(new Set(variants.map((item) => item.size).filter(Boolean))));
  const stock = variants.length > 0
    ? variants.reduce((total, item) => total + (item.stock || 0), 0)
    : product.quantity || 0;
  const imageGallery = normalizeProductImages(product);
  const colorOptions = getProductColorOptions({ ...product, variants, images: imageGallery });
  const rawPriceValues = variants.length > 0
    ? variants.map((item) => Number(item.price || 0))
    : [Number(product.price || 0)];
  const minPrice = Math.min(...rawPriceValues);
  const maxPrice = Math.max(...rawPriceValues);
  const minCurrentPrice = Number(minPrice || 0) * (1 - Number(product.discount || 0) / 100);
  const maxCurrentPrice = Number(maxPrice || 0) * (1 - Number(product.discount || 0) / 100);
  const defaultVariant = getDefaultVariant({ ...product, variants, colorOptions });
  const primaryImage = imageGallery.find((item) => item.isPrimary)?.url || imageGallery[0]?.url || product.image || null;

  return {
    ...product,
    category: getCategoryValue(product.category, detailView),
    categoryId: typeof product.category === 'object' && product.category?._id
      ? String(product.category._id)
      : product.category
        ? String(product.category)
        : null,
    image: primaryImage,
    currentPrice: product.finalPrice || minCurrentPrice,
    minPrice,
    maxPrice,
    minCurrentPrice,
    maxCurrentPrice,
    images: imageGallery,
    colors: colorOptions.map((item) => item.name),
    colorOptions,
    sizes,
    variants,
    stock,
    sku: defaultVariant?.sku || variants[0]?.sku || null,
    defaultVariant,
    rating: product.ratingAverage || 0,
    reviews: Array.from({ length: product.commentCount || 0 })
  };
};