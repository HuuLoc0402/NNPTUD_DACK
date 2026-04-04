const Product = require('../models/Product');
const { normalizeColorName } = require('./productVariant');

const getOrderItemQuantity = (item) => Math.max(0, Number(item?.quantity || 0));

const findVariantIndex = (product, item) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) {
    return -1;
  }

  const desiredSize = String(item?.selectedSize || item?.size || '').trim();
  const desiredColor = normalizeColorName(item?.selectedColor || item?.color || '');

  let index = variants.findIndex((variant) => (
    String(variant.size || '').trim() === desiredSize
    && normalizeColorName(variant.color) === desiredColor
  ));

  if (index >= 0) {
    return index;
  }

  index = variants.findIndex((variant) => normalizeColorName(variant.color) === desiredColor);
  if (index >= 0) {
    return index;
  }

  index = variants.findIndex((variant) => String(variant.size || '').trim() === desiredSize);
  return index;
};

const buildItemLabel = (item) => {
  const parts = [item?.productName || 'Sản phẩm'];
  if (item?.selectedColor) {
    parts.push(`màu ${item.selectedColor}`);
  }
  if (item?.selectedSize) {
    parts.push(`size ${item.selectedSize}`);
  }
  return parts.join(' ');
};

const validateOrderInventory = async (order) => {
  const items = Array.isArray(order?.items) ? order.items : [];

  for (const item of items) {
    const productId = item?.product?._id || item?.product;
    const quantity = getOrderItemQuantity(item);
    if (!productId || quantity <= 0) {
      return {
        ok: false,
        message: 'Dữ liệu sản phẩm trong đơn hàng không hợp lệ.'
      };
    }

    const product = await Product.findById(productId);
    if (!product) {
      return {
        ok: false,
        message: `Không tìm thấy ${buildItemLabel(item)}.`
      };
    }

    if (Array.isArray(product.variants) && product.variants.length) {
      const variantIndex = findVariantIndex(product, item);
      if (variantIndex < 0) {
        return {
          ok: false,
          message: `Không tìm thấy biến thể phù hợp cho ${buildItemLabel(item)}.`
        };
      }

      const variant = product.variants[variantIndex];
      if (Number(variant.stock || 0) < quantity) {
        return {
          ok: false,
          message: `${buildItemLabel(item)} chỉ còn ${Number(variant.stock || 0)} sản phẩm trong kho.`
        };
      }
      continue;
    }

    if (Number(product.quantity || 0) < quantity) {
      return {
        ok: false,
        message: `${buildItemLabel(item)} chỉ còn ${Number(product.quantity || 0)} sản phẩm trong kho.`
      };
    }
  }

  return { ok: true, message: '' };
};

const applyInventoryForOrder = async (order) => {
  if (!order || order.inventoryAdjustedAt) {
    return { updated: false };
  }

  const validation = await validateOrderInventory(order);
  if (!validation.ok) {
    throw new Error(validation.message || 'Không đủ tồn kho để hoàn tất đơn hàng.');
  }

  const items = Array.isArray(order.items) ? order.items : [];
  for (const item of items) {
    const productId = item?.product?._id || item?.product;
    const quantity = getOrderItemQuantity(item);
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error(`Không tìm thấy ${buildItemLabel(item)} để cập nhật tồn kho.`);
    }

    if (Array.isArray(product.variants) && product.variants.length) {
      const variantIndex = findVariantIndex(product, item);
      if (variantIndex < 0) {
        throw new Error(`Không tìm thấy biến thể phù hợp cho ${buildItemLabel(item)}.`);
      }

      product.variants[variantIndex].stock = Math.max(0, Number(product.variants[variantIndex].stock || 0) - quantity);
      product.quantity = product.variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock || 0)), 0);
    } else {
      product.quantity = Math.max(0, Number(product.quantity || 0) - quantity);
    }

    await product.save();
  }

  order.inventoryAdjustedAt = new Date();
  await order.save();

  return { updated: true };
};

module.exports = {
  validateOrderInventory,
  applyInventoryForOrder
};