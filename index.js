const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;
const API_PRODUCTS = 'https://api.escuelajs.co/api/v1/products';

app.use(express.static(path.join(__dirname, 'public')));

const FETCH_TIMEOUT_MS = 15000;
const FETCH_RETRIES = 2;

/**
 * Hàm getAll - Lấy toàn bộ sản phẩm từ API cho dashboard
 * Có timeout và retry khi lỗi mạng
 * @returns {Promise<Array>} Danh sách sản phẩm
 */
async function getAll() {
  for (let attempt = 1; attempt <= FETCH_RETRIES + 1; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(API_PRODUCTS, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      const msg = error.message || String(error);
      const cause = error.cause ? ` (${error.cause.message || error.cause})` : '';
      console.error(`getAll error [lần ${attempt}]:`, msg, cause);

      if (attempt <= FETCH_RETRIES) {
        console.log('Thử lại sau 2 giây...');
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      return [];
    }
  }
  return [];
}

/**
 * Lấy sản phẩm theo ID từ API
 * @param {string|number} id - ID sản phẩm
 * @returns {Promise<Object|null>} Sản phẩm hoặc null
 */
async function getById(id) {
  try {
    const response = await fetch(`${API_PRODUCTS}/${id}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('getById error:', error.message);
    return null;
  }
}

/**
 * Lọc sản phẩm theo các query params
 * @param {Array} products - Danh sách sản phẩm
 * @param {Object} query - Query params: title, maxPrice, minPrice, slug
 */
function filterProducts(products, query) {
  let result = [...products];

  // title: includes (tìm kiếm chuỗi con, không phân biệt hoa thường)
  if (query.title && query.title.trim()) {
    const titleLower = query.title.trim().toLowerCase();
    result = result.filter((p) =>
      (p.title || '').toLowerCase().includes(titleLower)
    );
  }

  // slug: equal (khớp chính xác)
  if (query.slug && query.slug.trim()) {
    const slugVal = query.slug.trim();
    result = result.filter((p) => (p.slug || '') === slugVal);
  }

  // minPrice: giá >= minPrice
  if (query.minPrice != null && query.minPrice !== '') {
    const min = parseFloat(query.minPrice);
    if (!isNaN(min)) {
      result = result.filter((p) => (p.price ?? 0) >= min);
    }
  }

  // maxPrice: giá <= maxPrice
  if (query.maxPrice != null && query.maxPrice !== '') {
    const max = parseFloat(query.maxPrice);
    if (!isNaN(max)) {
      result = result.filter((p) => (p.price ?? 0) <= max);
    }
  }

  return result;
}

// GET /api/products - Danh sách sản phẩm với query: title, maxPrice, minPrice, slug
app.get('/api/products', async (req, res) => {
  const products = await getAll();
  const filtered = filterProducts(products, req.query);
  res.json(filtered);
});

// GET /api/products/:id - Chi tiết sản phẩm theo ID
app.get('/api/products/:id', async (req, res) => {
  const id = req.params.id;
  const product = await getById(id);
  if (!product) {
    return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
  }
  res.json(product);
});

// Trang sản phẩm
app.get('/product', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'product.html'));
});

app.get('/', (req, res) => {
  res.redirect('/product');
});

app.listen(PORT, () => {
  console.log(`Server chạy tại http://localhost:${PORT}/product`);
});
