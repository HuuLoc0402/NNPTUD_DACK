const mongoose = require('mongoose');

const SIZE_NAMES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL', '6XL', 'One Size'];

const DEFAULT_SIZE_GUIDE = [
  {
    name: 'XXS',
    code: 'XXS',
    displayOrder: 1,
    usSize: '0',
    euSize: '32',
    height: '148 - 152',
    weight: '38 - 42',
    chest: '76.5 - 80.5',
    waist: '60 - 64',
    hip: '85 - 89'
  },
  {
    name: 'XS',
    code: 'XS',
    displayOrder: 2,
    usSize: '2',
    euSize: '34',
    height: '150 - 155',
    weight: '42 - 46',
    chest: '80.5 - 84.5',
    waist: '64 - 68',
    hip: '89 - 93'
  },
  {
    name: 'S',
    code: 'S',
    displayOrder: 3,
    usSize: '4',
    euSize: '36',
    height: '152 - 158',
    weight: '46 - 50',
    chest: '84.5 - 88.5',
    waist: '68 - 72',
    hip: '93 - 97'
  },
  {
    name: 'M',
    code: 'M',
    displayOrder: 4,
    usSize: '6',
    euSize: '38',
    height: '156 - 162',
    weight: '50 - 55',
    chest: '88.5 - 92.5',
    waist: '72 - 76',
    hip: '97 - 101'
  },
  {
    name: 'L',
    code: 'L',
    displayOrder: 5,
    usSize: '8',
    euSize: '40',
    height: '160 - 166',
    weight: '55 - 60',
    chest: '92.5 - 96.5',
    waist: '76 - 81',
    hip: '101 - 105'
  },
  {
    name: 'XL',
    code: 'XL',
    displayOrder: 6,
    usSize: '10',
    euSize: '42',
    height: '163 - 168',
    weight: '60 - 66',
    chest: '96.5 - 101.5',
    waist: '81 - 86',
    hip: '105 - 110'
  },
  {
    name: 'XXL',
    code: 'XXL',
    displayOrder: 7,
    usSize: '12',
    euSize: '44',
    height: '165 - 170',
    weight: '66 - 72',
    chest: '101.5 - 106.5',
    waist: '86 - 91',
    hip: '110 - 115'
  },
  {
    name: 'XXXL',
    code: 'XXXL',
    displayOrder: 8,
    usSize: '14',
    euSize: '46',
    height: '167 - 172',
    weight: '72 - 78',
    chest: '106.5 - 112',
    waist: '91 - 96',
    hip: '115 - 120'
  },
  {
    name: '4XL',
    code: '4XL',
    displayOrder: 9,
    usSize: '16',
    euSize: '48',
    height: '168 - 173',
    weight: '78 - 84',
    chest: '113 - 118',
    waist: '97 - 102',
    hip: '121 - 126'
  },
  {
    name: '5XL',
    code: '5XL',
    displayOrder: 10,
    usSize: '18',
    euSize: '50',
    height: '169 - 174',
    weight: '84 - 90',
    chest: '118 - 123',
    waist: '102 - 107',
    hip: '126 - 131'
  },
  {
    name: '6XL',
    code: '6XL',
    displayOrder: 11,
    usSize: '20',
    euSize: '52',
    height: '170 - 175',
    weight: '90 - 98',
    chest: '123 - 128',
    waist: '107 - 112',
    hip: '131 - 136'
  },
  {
    name: 'One Size',
    code: 'ONESIZE',
    displayOrder: 99,
    usSize: '-',
    euSize: '-',
    height: '-',
    weight: '-',
    chest: '-',
    waist: '-',
    hip: '-',
    fitNote: 'Freesize, phù hợp nhiều dáng người tùy chất liệu và form sản phẩm.'
  }
];

const sizeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Size name is required'],
      trim: true,
      unique: true,
      enum: SIZE_NAMES
    },
    code: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true
    },
    displayOrder: {
      type: Number,
      default: 0
    },
    usSize: {
      type: String,
      trim: true,
      default: ''
    },
    euSize: {
      type: String,
      trim: true,
      default: ''
    },
    height: {
      type: String,
      trim: true,
      default: ''
    },
    weight: {
      type: String,
      trim: true,
      default: ''
    },
    chest: {
      type: String,
      trim: true,
      default: ''
    },
    waist: {
      type: String,
      trim: true,
      default: ''
    },
    hip: {
      type: String,
      trim: true,
      default: ''
    },
    fitNote: {
      type: String,
      trim: true,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

sizeSchema.index({ displayOrder: 1, isActive: 1 });

const Size = mongoose.model('Size', sizeSchema);

Size.SIZE_NAMES = SIZE_NAMES;
Size.DEFAULT_SIZE_GUIDE = DEFAULT_SIZE_GUIDE;

module.exports = Size;
