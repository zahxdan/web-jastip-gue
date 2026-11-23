import { useEffect, useRef } from 'react';
import { fmtDate } from '../lib/format';

export const GUIDE_KEY = 'po_guide_seen_v1';

// Ubah isi langkah di sini kalau aturan PO-mu berubah (mis. DP, jam pickup, minimal order)
const STEPS = [
  ['Pilih menu', 'Tekan + Tambah pada produk yang kamu mau, lalu atur jumlahnya.'],
  ['Buka keranjang', 'Cek pesananmu, isi nama, lalu pilih Pengiriman atau Pickup.'],
  ['Kirim lewat WhatsApp', 'Tekan Pesan via WhatsApp. Rekap pesanan terisi otomatis, tinggal kirim.'],
  ['Mau titip barang lain?', 'Pakai tombol Request / titip barang lain di bagian atas. Kamu langsung diarahkan ke chat WhatsApp.'],
];

export default function GuideModal({ regions, onClose }) {
  // <dialog> bawaan browser: Esc, fokus terkunci di dalam dialog, dan latar belakang tidak bisa diklik
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => { if (d && d.open) d.close(); };
  }, []);

  const withDate = regions.filter((r) => r.close_date);

  return (
    <dialog
      ref={ref}
      aria-labelledby="guide-title"
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="m-0 mt-auto w-full max-w-none overflow-hidden rounded-t-3xl bg-white p-0 text-ink backdrop:bg-ink/60 sm:m-auto sm:max-w-md sm:rounded-3xl"
    >
      <div className="max-h-[92vh] overflow-y-auto p-6">
        <h2 id="guide-title" className="font-display text-2xl font-extrabold">Cara Pesan</h2>
        <ol className="mt-4 space-y-3">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-leaf text-sm font-bold text-white">{i + 1}</span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-ink/70">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        {withDate.length > 0 && (
          <div className="mt-4 rounded-2xl bg-saffron-soft p-3 text-sm">
            {withDate.map((r) => (
              <p key={r.region_id}><b>{r.title || r.region_id}</b> tutup {fmtDate(r.close_date)}</p>
            ))}
          </div>
        )}
        <button onClick={onClose} className="mt-5 w-full rounded-2xl bg-leaf py-3.5 font-bold text-white">Mengerti, lihat menu</button>
      </div>
    </dialog>
  );
}