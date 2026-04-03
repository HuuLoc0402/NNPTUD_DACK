const express = require('express');
const Product = require('../models/Product');
const cartController = require('../controllers/cartController');
const productController = require('../controllers/productController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const formatCart = (cart) => {
  const cartObject = cart.toObject ? cart.toObject() : cart;
  return {
    ...cartObject,
    items: (cartObject.items || []).map((item) => ({
      ...item,
      product: item.product ? productController.formatProduct(item.product, true) : null
    }))
  };
};

const resolveUnitPrice = (product, size) => {
  const variant = (product.variants || []).find((item) => item.size === size);
  return variant?.price || product.finalPrice || product.price;
};

router.get('/', authenticate, async (req, res, next) => {
  try {
    const cart = await cartController.findOrCreateCart(req.userId);
    return res.status(200).json({ success: true, data: formatCart(cart) });
  } catch (error) {
    next(error);
  }
});

router.post('/add', authenticate, async (req, res, next) => {
  try {
    const productId = req.body.productId || req.body.product;
    const quantity = Number(req.body.quantity || 1);
    const selectedSize = req.body.size || req.body.selectedSize || 'M';
    const selectedColor = req.body.color || req.body.selectedColor || 'default';
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const cart = await cartController.findOrCreateCart(req.userId);
    const index = cart.items.findIndex((item) =>
      String(item.product) === String(product._id)
      && item.selectedSize === selectedSize
      && item.selectedColor === selectedColor
    );

    if (index >= 0) {
      cart.items[index].quantity += quantity;
    } else {
      cart.items.push({
        product: product._id,
        quantity,
        selectedSize,
        selectedColor,
        price: resolveUnitPrice(product, selectedSize),
        discount: product.discount || 0
      });
    }

    const savedCart = await cartController.saveCart(cart);
    return res.status(200).json({ success: true, data: formatCart(savedCart) });
  } catch (error) {
    next(error);
  }
});

router.put('/update', authenticate, async (req, res, next) => {
  try {
    const productId = req.body.productId || req.body.product;
    const quantity = Number(req.body.quantity || 1);
    const selectedSize = req.body.size || req.body.selectedSize || 'M';
    const selectedColor = req.body.color || req.body.selectedColor || 'default';
    const cart = await cartController.findOrCreateCart(req.userId);
    const item = cart.items.find((cartItem) =>
      String(cartItem.product) === String(productId)
      && cartItem.selectedSize === selectedSize
      && cartItem.selectedColor === selectedColor
    );

    if (!item) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    item.quantity = Math.max(1, quantity);
    const savedCart = await cartController.saveCart(cart);
    return res.status(200).json({ success: true, data: formatCart(savedCart) });
  } catch (error) {
    next(error);
  }
});

router.delete('/remove/:productId/:size/:color', authenticate, async (req, res, next) => {
  try {
    const cart = await cartController.findOrCreateCart(req.userId);
    cart.items = cart.items.filter((item) => !(
      String(item.product) === String(req.params.productId)
      && item.selectedSize === req.params.size
      && item.selectedColor === req.params.color
    ));

    const savedCart = await cartController.saveCart(cart);
    return res.status(200).json({ success: true, data: formatCart(savedCart) });
  } catch (error) {
    next(error);
  }
});

router.delete('/clear', authenticate, async (req, res, next) => {
  try {
    const cart = await cartController.clearCart(req.userId);
    return res.status(200).json({ success: true, data: formatCart(cart) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;