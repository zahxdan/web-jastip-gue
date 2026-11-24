import { useMemo, useState } from 'react';
import { rupiah } from '../lib/format';

export default function CartDrawer({ lines, regionTitles, waNumber, onChange, onClose }) {
  const [name, setName] = useState('');
  const [delivery, setDelivery] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const total = lines.reduce((s, l) => s + l.p.price * l.qty, 0);

  // region -> brand -> baris
  const groups = useMemo(() => {
    const out = {};
    for (const l of lines) {
      const r = l.p.region;
      const b = l.p.brand || 'Lainnya';
      ((out[r] ||= {})[b] ||= []).push(l);
    }
    return out;
  }, [lines]);

  const send = () => {
    if (!name.trim()) return setError('Isi nama pemesan dulu.');
    if (!delivery) return setError('Pilih pengiriman atau pickup.');
    const msg = [`*PESANAN PO*`, `Nama: ${name.trim()}`, `Pengiriman: ${delivery}`, ''];
    for (const [region, brands] of Object.entries(groups)) {
      msg.push(`*${regionTitles[region] || region}*`);
      for (const [brand, items] of Object.entries(brands)) {
        msg.push(`_${brand}_`);
        for (const { p, qty } of items) msg.push(`• ${qty}x ${p.name} = ${rupiah(p.price * qty)}`);
      }
      msg.push('');
    }
    msg.push(`*Total: ${rupiah(total)}*`);
    if (note.trim()) msg.push('', '*Request / Catatan:*', note.trim());
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg.join('\n'))}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-ink/50 sm:items-stretch sm:justify-end" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white sm:max-h-none sm:max-w-md sm:rounded-none" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-extrabold">Keranjang</h2>
          <button onClick={onClose} className="rounded-lg px-3 py-1 text-sm font-semibold text-leaf">Tutup</button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {lines.length === 0 && <p className="py-10 text-center text-sm text-ink/60">Keranjang masih kosong. Pilih menu dulu.</p>}
          {Object.entries(groups).map(([region, brands]) => (
            <section key={region}>
              <h3 className="font-display text-base font-extrabold text-leaf-dark">{regionTitles[region] || region}</h3>
              {Object.entries(brands).map(([brand, items]) => (
                <div key={brand} className="mt-2">
                  <p className="text-xs font-semibold text-ink/60">{brand}</p>
                  {items.map(({ p, qty }) => (
                    <div key={p.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{p.name}</p>
                        <p className="text-xs text-ink/60">{rupiah(p.price)} × {qty} = <b className="text-ink">{rupiah(p.price * qty)}</b></p>
                      </div>
                      <div className="flex items-center rounded-lg border border-line">
                        <button onClick={() => onChange(p.id, qty - 1)} aria-label="Kurangi" className="h-8 w-8 font-bold">−</button>
                        <span className="w-6 text-center text-sm font-bold">{qty}</span>
                        <button onClick={() => onChange(p.id, qty + 1)} aria-label="Tambah" className="h-8 w-8 font-bold">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </section>
          ))}

          {lines.length > 0 && (
            <div className="space-y-3 border-t border-line pt-4">
              <label className="block text-sm font-semibold">
                Nama pemesan
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kamu" className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 font-normal outline-none focus:border-leaf" />
              </label>
              <fieldset>
                <legend className="text-sm font-semibold">Pengiriman</legend>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {['Liebra 121', 'Pickup di Teluk Gong'].map((o) => (
                    <button key={o} type="button" onClick={() => setDelivery(o)}
                      className={`rounded-xl border py-2.5 text-sm font-semibold ${delivery === o ? 'border-leaf bg-leaf text-white' : 'border-line'}`}>
                      {o}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="block text-sm font-semibold">
                Request produk lainnya / catatan
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                  placeholder="Mau titip barang di luar menu? Tulis di sini. Alamat pengiriman juga boleh."
                  className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 font-normal outline-none focus:border-leaf" />
              </label>
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <div className="border-t border-line px-5 py-4">
            {error && <p className="mb-2 text-sm font-medium text-red-600">{error}</p>}
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-sm text-ink/70">Total</span>
              <span className="font-display text-xl font-extrabold">{rupiah(total)}</span>
            </div>
            <button onClick={send} className="w-full rounded-2xl bg-[#1FA855] py-3.5 font-bold text-white active:brightness-90">
              Pesan via WhatsApp
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
