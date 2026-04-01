const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Role name is required'],
      trim: true,
      unique: true,
      enum: ['user', 'admin']
    },
    description: {
      type: String,
      trim: true
    },
    permissions: [
      {
        type: String,
        trim: true
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

const Role = mongoose.model('Role', roleSchema);

module.exports = Role;
