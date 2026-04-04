const fs = require('fs');
const path = require('path');

const uploadsRoot = path.resolve(__dirname, '../../uploads');
const MANAGED_FOLDERS = ['product', 'category', 'collection', 'useravatar'];

function ensureDirectory(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

ensureDirectory(uploadsRoot);
MANAGED_FOLDERS.forEach((folder) => ensureDirectory(path.join(uploadsRoot, folder)));

function sanitizeFilenameBase(value) {
  return String(value || 'file')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'file';
}

function resolveUploadFolder(req, file) {
  const baseUrl = String(req?.baseUrl || '').toLowerCase();
  const routePath = String(req?.path || '').toLowerCase();
  const fieldName = String(file?.fieldname || '').toLowerCase();

  if (fieldName === 'avatar' || baseUrl.includes('/auth') || routePath.includes('/profile/avatar')) {
    return 'useravatar';
  }

  if (baseUrl.includes('/products')) {
    return 'product';
  }

  if (baseUrl.includes('/categories')) {
    return 'category';
  }

  if (baseUrl.includes('/collections')) {
    return 'collection';
  }

  return 'misc';
}

function getUploadDirectory(folder) {
  const safeFolder = MANAGED_FOLDERS.includes(folder) ? folder : 'misc';
  const directory = path.join(uploadsRoot, safeFolder);
  ensureDirectory(directory);
  return directory;
}

function createManagedFilename(folder, originalName) {
  const extension = path.extname(String(originalName || '')).toLowerCase() || '.png';
  const baseName = sanitizeFilenameBase(path.basename(String(originalName || 'file'), extension));
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  return `${folder}-${baseName}-${uniqueSuffix}${extension}`;
}

function buildUploadedFileUrl(file) {
  if (!file) {
    return null;
  }

  const filePath = file.path || path.join(file.destination || '', file.filename || '');
  const relativePath = path.relative(uploadsRoot, filePath).replace(/\\/g, '/');
  if (!relativePath || relativePath.startsWith('..')) {
    return null;
  }

  return `/uploads/${relativePath}`;
}

function getAbsoluteUploadPath(uploadUrl) {
  const normalizedUrl = String(uploadUrl || '').split('?')[0].trim().replace(/\\/g, '/');
  if (!normalizedUrl.startsWith('/uploads/')) {
    return null;
  }

  const relativePath = normalizedUrl.replace(/^\/uploads\/?/i, '');
  const absolutePath = path.resolve(uploadsRoot, relativePath);
  if (!absolutePath.startsWith(uploadsRoot)) {
    return null;
  }

  return absolutePath;
}

function isManagedUploadUrl(uploadUrl) {
  return Boolean(getAbsoluteUploadPath(uploadUrl));
}

async function removeEmptyParents(startDirectory) {
  let currentDirectory = startDirectory;

  while (currentDirectory && currentDirectory !== uploadsRoot) {
    const items = await fs.promises.readdir(currentDirectory).catch(() => []);
    if (items.length > 0) {
      break;
    }

    await fs.promises.rmdir(currentDirectory).catch(() => {});
    currentDirectory = path.dirname(currentDirectory);
  }
}

async function deleteUploadFile(uploadUrl) {
  const absolutePath = getAbsoluteUploadPath(uploadUrl);
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return false;
  }

  await fs.promises.unlink(absolutePath).catch(() => {});
  await removeEmptyParents(path.dirname(absolutePath));
  return true;
}

async function deleteUploadFiles(uploadUrls = []) {
  const uniqueUrls = Array.from(new Set((Array.isArray(uploadUrls) ? uploadUrls : []).filter(Boolean)));
  for (const uploadUrl of uniqueUrls) {
    await deleteUploadFile(uploadUrl);
  }
}

function collectProductImageUrls(product) {
  const urls = new Set();
  if (product?.image) {
    urls.add(product.image);
  }

  if (Array.isArray(product?.images)) {
    product.images.forEach((image) => {
      if (image?.url) {
        urls.add(image.url);
      }
    });
  }

  return Array.from(urls).filter(isManagedUploadUrl);
}

function buildMovedUploadUrl(folder, fileName) {
  return `/uploads/${folder}/${fileName}`;
}

async function moveUploadFile(uploadUrl, folder) {
  const sourcePath = getAbsoluteUploadPath(uploadUrl);
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return uploadUrl;
  }

  const safeFolder = MANAGED_FOLDERS.includes(folder) ? folder : 'misc';
  const targetDirectory = getUploadDirectory(safeFolder);
  const sourceFileName = path.basename(sourcePath);
  let targetPath = path.join(targetDirectory, sourceFileName);

  if (sourcePath === targetPath) {
    return buildMovedUploadUrl(safeFolder, sourceFileName);
  }

  if (fs.existsSync(targetPath)) {
    const extension = path.extname(sourceFileName);
    const nameWithoutExtension = path.basename(sourceFileName, extension);
    targetPath = path.join(targetDirectory, `${nameWithoutExtension}-${Date.now()}${extension}`);
  }

  await fs.promises.rename(sourcePath, targetPath);
  await removeEmptyParents(path.dirname(sourcePath));
  return buildMovedUploadUrl(safeFolder, path.basename(targetPath));
}

module.exports = {
  uploadsRoot,
  MANAGED_FOLDERS,
  resolveUploadFolder,
  getUploadDirectory,
  createManagedFilename,
  buildUploadedFileUrl,
  getAbsoluteUploadPath,
  isManagedUploadUrl,
  deleteUploadFile,
  deleteUploadFiles,
  collectProductImageUrls,
  moveUploadFile
};