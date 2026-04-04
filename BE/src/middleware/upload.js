const multer = require('multer');
const path = require('path');
const {
  resolveUploadFolder,
  getUploadDirectory,
  createManagedFilename
} = require('../utils/uploadStorage');

// Storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folder = resolveUploadFolder(req, file);
    cb(null, getUploadDirectory(folder));
  },
  filename: function (req, file, cb) {
    const folder = resolveUploadFolder(req, file);
    cb(null, createManagedFilename(folder, file.originalname));
  }
});

// Filter for image files only
const fileFilter = (req, file, cb) => {
  // Allowed image types
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, png, gif, webp)'), false);
  }
};

// Upload middleware
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

module.exports = upload;
