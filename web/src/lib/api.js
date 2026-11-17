const API_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '[MASUKKAN_URL_APPS_SCRIPT_ATAU_GUNAKAN_ENV]';
export const WA_NUMBER = import.meta.env.VITE_WA_NUMBER || '6285128021328';

// Nama action yang dikirim ke Apps Script. Ubah di sini kalau di script namanya beda.
export const ACTIONS = {
  verify: 'verify_pin',
  listAll: 'list_all',
  toggleRegion: 'toggle_region',
  add: 'add_product',
  edit: 'edit_product',
  remove: 'delete_product',
};

const CACHE_KEY = 'po_catalog_v1';
const CACHE_MS = 5 * 60 * 1000;

const bool = (v) => v === true || String(v).trim().toUpperCase() === 'TRUE';

function normalizeRegions(raw) {
  const list = Array.isArray(raw) ? raw : Object.entries(raw || {}).map(([k, v]) => ({ region_id: k, ...v }));
  return list.map((r) => ({
    region_id: String(r.region_id || r.id || '').toUpperCase(),
    title: r.title || '',
    is_active: bool(r.is_active ?? true),
    close_date: r.close_date || '',
    delivery_info: r.delivery_info || '',
  }));
}

function normalizeProducts(raw) {
  return (raw || []).map((p) => ({
    id: String(p.id),
    region: String(p.region || '').toUpperCase(),
    name: p.name || '',
    brand: p.brand || '',
    category: p.category || '',
    price: Number(String(p.price ?? 0).replace(/\D/g, '')) || 0,
    shelf_life: p.shelf_life || '',
    image_url: p.image_url || '',
    is_available: bool(p.is_available),
  }));
}

function normalize(json) {
  return { regions: normalizeRegions(json.active_regions), products: normalizeProducts(json.products) };
}

export const clearCache = () => { try { sessionStorage.removeItem(CACHE_KEY); } catch { /* abaikan */ } };

export async function getCatalog() {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
    if (c && Date.now() - c.t < CACHE_MS) return c.data;
  } catch { /* abaikan */ }
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error('Gagal memuat menu (' + res.status + ')');
  const data = normalize(await res.json());
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data })); } catch { /* abaikan */ }
  return data;
}

// text/plain supaya tidak memicu CORS preflight di Apps Script
export async function post(body) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json && (json.error || json.success === false || json.ok === false)) {
    throw new Error(json.error || json.message || 'Permintaan ditolak');
  }
  return json;
}

export async function verifyPin(pin) {
  await post({ pin, action: ACTIONS.verify });
  return true;
}

// Admin butuh SEMUA produk (termasuk habis / harga 0) dan semua kloter
export async function getAdminCatalog(pin) {
  let json;
  try {
    json = await post({ pin, action: ACTIONS.listAll });
  } catch { json = null; }
  if (!json || !json.products) {
    const res = await fetch(API_URL);
    json = await res.json();
  }
  const data = normalize(json);
  for (const id of ['BANDUNG', 'HOMEMADE']) {
    if (!data.regions.find((r) => r.region_id === id)) {
      data.regions.push({ region_id: id, title: id, is_active: false, close_date: '', delivery_info: '' });
    }
  }
  return data;
}
