const Category = require('../models/Category');

exports.createCategory = (payload) => {
  const category = new Category(payload);
  return category.save();
};

exports.findCategories = (filter = {}) => {
  return Category.find(filter).sort({ displayOrder: 1, name: 1 }).populate('parent', 'name slug');
};

exports.findCategoryById = (categoryId) => {
  return Category.findById(categoryId).populate('parent', 'name slug');
};

exports.findCategoryBySlug = (slug) => {
  return Category.findOne({ slug }).populate('parent', 'name slug');
};

exports.updateCategory = (categoryId, updateData) => {
  return Category.findByIdAndUpdate(categoryId, updateData, {
    new: true,
    runValidators: true
  }).populate('parent', 'name slug');
};

exports.deleteCategory = (categoryId) => {
  return Category.findByIdAndDelete(categoryId);
};