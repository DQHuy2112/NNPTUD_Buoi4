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

// API cho dashboard: GET /api/products
app.get('/api/products', async (req, res) => {
  const products = await getAll();
  res.json(products);
});

// Trang dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

app.listen(PORT, () => {
  console.log(`Server chạy tại http://localhost:${PORT}/dashboard`);
});
