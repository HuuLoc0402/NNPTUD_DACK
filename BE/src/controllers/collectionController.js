const Collection = require('../models/Collection');
const productController = require('./productController');

exports.createCollection = (payload) => {
  const collection = new Collection(payload);
  return collection.save();
};

exports.findCollections = (filter = {}) => {
  return Collection.find(filter).sort({ displayOrder: 1, createdAt: -1 });
};

exports.findCollectionById = (collectionId) => {
  return Collection.findById(collectionId).populate({
    path: 'products',
    populate: {
      path: 'category',
      select: 'name slug'
    }
  });
};

exports.findCollectionBySlug = (slug) => {
  return Collection.findOne({ slug }).populate({
    path: 'products',
    populate: {
      path: 'category',
      select: 'name slug'
    }
  });
};

exports.updateCollection = (collectionId, updateData) => {
  return Collection.findByIdAndUpdate(collectionId, updateData, {
    new: true,
    runValidators: true
  }).populate({
    path: 'products',
    populate: {
      path: 'category',
      select: 'name slug'
    }
  });
};

exports.deleteCollection = (collectionId) => {
  return Collection.findByIdAndDelete(collectionId);
};

exports.formatCollection = (collectionDoc, options = {}) => {
  const { includeProducts = false, adminView = false } = options;
  const collection = collectionDoc?.toObject ? collectionDoc.toObject() : collectionDoc;
  const productIds = Array.isArray(collection?.products)
    ? collection.products.map((product) => String(product?._id || product)).filter(Boolean)
    : [];

  const formattedProducts = includeProducts && Array.isArray(collection?.products)
    ? collection.products
      .filter((product) => product && (adminView || product.isActive !== false))
      .map((product) => productController.formatProduct(product, true))
    : [];

  return {
    ...collection,
    productIds,
    productCount: includeProducts ? formattedProducts.length : productIds.length,
    products: includeProducts ? formattedProducts : undefined
  };
};