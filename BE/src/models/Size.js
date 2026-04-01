const mongoose = require('mongoose');

const sizeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Size name is required'],
      trim: true,
      unique: true,
      enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'One Size']
    },
    code: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

const Size = mongoose.model('Size', sizeSchema);

module.exports = Size;
