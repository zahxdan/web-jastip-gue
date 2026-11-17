import { useState } from 'react';
import { rupiah } from '../lib/format';

export default function ProductCard({ p, qty, onChange }) {
  const [broken, setBroken] = useState(false);
  const soldOut = !p.is_available;
  const blocked = soldOut || p.price <= 0;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
      <div className="relative aspect-square bg-leaf-soft">
        {p.image_url && !broken ? (
          <img src={p.image_url} alt={p.name} loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center px-3 text-center font-display text-sm font-semibold text-leaf/60">{p.brand}</div>
        )}
        <span className="absolute left-2 top-2 max-w-[85%] truncate rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-leaf-dark">{p.brand}</span>
        {blocked && (
          <div className="absolute inset-0 grid place-items-center bg-white/75 text-sm font-bold">
            {soldOut ? 'Habis' : 'Harga menyusul'}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</h3>
        {p.shelf_life && (
          <span className="w-fit rounded-md bg-saffron-soft px-1.5 py-0.5 text-[11px] font-medium text-[#7A5600]">{p.shelf_life}</span>
        )}
        <div className="mt-auto pt-1">
          <p className="font-display text-base font-extrabold text-leaf-dark">{rupiah(p.price)}</p>
          {qty > 0 ? (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-leaf px-1 py-1 text-white">
              <button onClick={() => onChange(p.id, qty - 1)} aria-label="Kurangi" className="h-8 w-8 rounded-lg text-lg font-bold active:bg-leaf-dark">−</button>
              <span className="min-w-6 text-center text-sm font-bold">{qty}</span>
              <button onClick={() => onChange(p.id, qty + 1)} aria-label="Tambah" className="h-8 w-8 rounded-lg text-lg font-bold active:bg-leaf-dark">+</button>
            </div>
          ) : (
            <button
              disabled={blocked}
              onClick={() => onChange(p.id, 1)}
              className="mt-2 w-full rounded-xl border border-leaf py-2 text-sm font-semibold text-leaf transition active:bg-leaf-soft disabled:cursor-not-allowed disabled:border-line disabled:text-ink/40"
            >
              + Tambah
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
