# PO Jastip Bandung & Homemade

React (Vite) + Tailwind + react-router-dom. Backend: Google Apps Script + Google Sheets.

## Jalankan
```bash
npm install
cp .env.example .env     # isi VITE_APPS_SCRIPT_URL (dan VITE_WA_NUMBER bila perlu)
npm run dev
```

## Deploy Netlify
- Build command: `npm run build` | Publish directory: `dist`
- Environment variables: `VITE_APPS_SCRIPT_URL`, `VITE_WA_NUMBER`
- `public/_redirects` sudah ada, jadi refresh di `/admin` tidak 404.

## Kontrak API (src/lib/api.js)
GET -> `{ active_regions, products }`
- `active_regions`: array atau objek per `region_id`, isi `region_id,title,is_active,close_date,delivery_info`.
- Pembeli hanya menampilkan region dengan `is_active = TRUE`.

POST (body JSON, header `text/plain;charset=utf-8`, selalu berisi `pin`):

| action | field |
|---|---|
| `verify_pin` | - |
| `list_all` | - (balikan `{active_regions, products}` LENGKAP, termasuk produk habis/harga 0 dan kloter nonaktif) |
| `toggle_region` | `region_id,is_active,close_date,delivery_info` |
| `add_product` | `region,name,brand,category,price,shelf_life,image_base64,image_name` |
| `edit_product` | `id,region,name,brand,category,price,shelf_life,image_url,image_base64,image_name,is_available` |
| `delete_product` | `id` |

`verify_pin`, `list_all`, `delete_product` adalah nama action tambahan. Kalau di Apps Script namanya beda, ubah di objek `ACTIONS` pada `src/lib/api.js`.
Kalau `list_all` belum ada, halaman admin otomatis memakai GET biasa (produk habis mungkin tidak tampil).

## Import produk
Upload `produk_bandung_SEMUA.csv` ke tab `Products` (9 kolom, baris pertama = header).
