const PRODUCT_SIZE_ENUM = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL', '6XL', 'One Size'];

const SIZE_ORDER = PRODUCT_SIZE_ENUM.reduce((map, size, index) => {
  map[size] = index;
  return map;
}, {});

const DEFAULT_COLOR_MAP = {
  den: '#111111',
  do: '#C0392B',
  trang: '#F4F4F4',
  kem: '#F3EAD8',
  vang: '#D4AF37',
  xanh: '#3F7CAC',
  xanhduong: '#2D6CDF',
  xanhla: '#2E8B57',
  hong: '#D97B93',
  tim: '#7F6EDB',
  nau: '#8A5A44',
  xam: '#8C8C8C',
  ghi: '#8C8C8C',
  be: '#D8C3A5',
  cam: '#DE7C2F'
};

const toSearchToken = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '')
  .toLowerCase();

const slugifySegment = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .trim()
  .replace(/[^A-Z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const normalizeColorName = (value) => {
  const normalized = String(value || '').trim();
  return normalized || 'Mac dinh';
};

const extractProvidedColorName = (item) => {
  const rawValue = typeof item === 'string'
    ? item
    : item?.name ?? item?.color;
  const normalized = String(rawValue || '').trim();
  return normalized || null;
};

const normalizeColorCode = (value, colorName = '') => {
  const code = String(value || '').trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(code)) {
    return code.toUpperCase();
  }

  return DEFAULT_COLOR_MAP[toSearchToken(colorName)] || '#D9D9D9';
};

const dedupeColorOptions = (items = []) => {
  const seen = new Map();

  items.forEach((item) => {
    const rawName = extractProvidedColorName(item);
    if (!rawName) {
      return;
    }

    const name = normalizeColorName(rawName);
    const key = toSearchToken(name);
    if (!key) {
      return;
    }

    if (!seen.has(key)) {
      seen.set(key, {
        name,
        code: normalizeColorCode(item?.code || item?.colorCode, name)
      });
      return;
    }

    const existing = seen.get(key);
    if ((!existing.code || existing.code === '#D9D9D9') && (item?.code || item?.colorCode)) {
      existing.code = normalizeColorCode(item.code || item.colorCode, name);
    }
  });

  return Array.from(seen.values());
};

const sortSizes = (sizes = []) => [...sizes].sort((left, right) => {
  const leftOrder = SIZE_ORDER[left] ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = SIZE_ORDER[right] ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return String(left).localeCompare(String(right));
});

const normalizeProductImages = (product) => {
  if (Array.isArray(product?.images) && product.images.length > 0) {
    return product.images
      .map((item, index) => {
        if (typeof item === 'string') {
          return {
            url: item,
            color: null,
            alt: '',
            isPrimary: index === 0
          };
        }

        if (!item?.url) {
          return null;
        }

        return {
          url: item.url,
          color: item.color ? normalizeColorName(item.color) : null,
          alt: item.alt || '',
          isPrimary: Boolean(item.isPrimary) || index === 0
        };
      })
      .filter(Boolean);
  }

  if (product?.image) {
    return [{
      url: product.image,
      color: null,
      alt: '',
      isPrimary: true
    }];
  }

  return [];
};

const getProductColorOptions = (product) => {
  const variantOptions = Array.isArray(product?.variants)
    ? product.variants
      .filter((item) => extractProvidedColorName(item?.color))
      .map((item) => ({ name: item.color, code: item.colorCode }))
    : [];
  const imageOptions = normalizeProductImages(product)
    .filter((item) => extractProvidedColorName(item?.color))
    .map((item) => ({ name: item.color }));

  if (variantOptions.length || imageOptions.length) {
    return dedupeColorOptions([...variantOptions, ...imageOptions]);
  }

  const productOptions = Array.isArray(product?.colorOptions)
    ? product.colorOptions.filter((item) => extractProvidedColorName(item))
    : [];

  if (productOptions.length) {
    return dedupeColorOptions(productOptions);
  }

  const legacyProductOptions = Array.isArray(product?.color)
    ? product.color
      .filter((item) => extractProvidedColorName(item))
      .map((item) => ({ name: item }))
    : [];

  return dedupeColorOptions(legacyProductOptions);
};

const findMatchingVariant = (product, selection = {}) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) {
    return null;
  }

  const desiredSize = selection.size || null;
  const desiredColor = normalizeColorName(selection.color);

  const exactMatch = variants.find((item) => item.size === desiredSize && normalizeColorName(item.color) === desiredColor);
  if (exactMatch) {
    return exactMatch;
  }

  if (desiredColor) {
    const sameColor = variants.find((item) => normalizeColorName(item.color) === desiredColor);
    if (sameColor) {
      return sameColor;
    }
  }

  if (desiredSize) {
    const sameSize = variants.find((item) => item.size === desiredSize);
    if (sameSize) {
      return sameSize;
    }
  }

  return variants[0];
};

const getDefaultVariant = (product) => {
  return findMatchingVariant(product, {
    color: getProductColorOptions(product)[0]?.name,
    size: Array.isArray(product?.variants) ? product.variants[0]?.size : null
  });
};

const getImagesForColor = (product, color) => {
  const allImages = normalizeProductImages(product);
  if (!allImages.length) {
    return [];
  }

  const desiredColor = normalizeColorName(color);
  const exactMatches = allImages.filter((item) => normalizeColorName(item.color) === desiredColor);
  const sharedImages = allImages.filter((item) => !item.color);

  if (exactMatches.length) {
    return [...exactMatches, ...sharedImages];
  }

  return allImages;
};

const buildVariantSkuSeed = ({ name, color, size }) => {
  const nameToken = slugifySegment(name).split('-').slice(0, 2).join('-') || 'PRODUCT';
  const colorToken = slugifySegment(color).slice(0, 10) || 'DEFAULT';
  const sizeToken = slugifySegment(size).replace(/-/g, '') || 'M';
  return ['PRD', nameToken, colorToken, sizeToken].filter(Boolean).join('-');
};

module.exports = {
  PRODUCT_SIZE_ENUM,
  SIZE_ORDER,
  normalizeColorName,
  normalizeColorCode,
  dedupeColorOptions,
  sortSizes,
  normalizeProductImages,
  getProductColorOptions,
  findMatchingVariant,
  getDefaultVariant,
  getImagesForColor,
  buildVariantSkuSeed
};