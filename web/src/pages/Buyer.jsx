import { useEffect, useMemo, useState } from 'react';
import { getCatalog, WA_NUMBER } from '../lib/api';
import { fmtDate, rupiah } from '../lib/format';
import ProductCard from '../components/ProductCard';
import CartDrawer from '../components/CartDrawer';
import GuideModal, { GUIDE_KEY } from '../components/GuideModal';

const Skeleton = () => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-line bg-white">
        <div className="aspect-square bg-leaf-soft" />
        <div className="space-y-2 p-3"><div className="h-3 w-4/5 rounded bg-line" /><div className="h-3 w-2/5 rounded bg-line" /><div className="h-8 rounded bg-line" /></div>
      </div>
    ))}
  </div>
);

export default function Buyer() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('ALL');
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState('Semua');
  const [open, setOpen] = useState(false);
  const [guide, setGuide] = useState(false);
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('po_cart') || '{}'); } catch { return {}; }
  });

  const load = () => { setError(''); getCatalog().then(setData).catch((e) => setError(e.message)); };
  useEffect(load, []);
  useEffect(() => { try { sessionStorage.setItem('po_cart', JSON.stringify(cart)); } catch { /* abaikan */ } }, [cart]);

  const active = useMemo(() => (data ? data.regions.filter((r) => r.is_active) : []), [data]);
  const activeIds = active.map((r) => r.region_id);
  const both = activeIds.includes('BANDUNG') && activeIds.includes('HOMEMADE');

  // Popup petunjuk: tampil sekali saat pertama masuk, bisa dibuka lagi lewat tombol "Cara pesan"
  useEffect(() => {
    if (!data || active.length === 0) return;
    try { if (!localStorage.getItem(GUIDE_KEY)) setGuide(true); } catch { setGuide(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  const closeGuide = () => {
    setGuide(false);
    try { localStorage.setItem(GUIDE_KEY, '1'); } catch { /* abaikan */ }
  };
  const requestLink = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Halo, aku mau request/titip barang di luar menu PO: ')}`;
  const regionTitles = useMemo(
    () => Object.fromEntries((data?.regions || []).map((r) => [r.region_id, r.title || r.region_id])), [data]);

  const scope = both ? (tab === 'ALL' ? activeIds : [tab]) : activeIds;
  const inScope = useMemo(
    () => (data ? data.products.filter((p) => scope.includes(p.region)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, tab, activeIds.join(',')]);

  const brands = useMemo(() => {
    const count = {};
    inScope.forEach((p) => { if (p.brand) count[p.brand] = (count[p.brand] || 0) + 1; });
    return ['Semua', ...Object.keys(count).sort((a, b) => count[b] - count[a])];
  }, [inScope]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return inScope.filter((p) =>
      (brand === 'Semua' || p.brand === brand) &&
      (!s || `${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(s)));
  }, [inScope, brand, q]);

  const setQty = (id, n) =>
    setCart((c) => { const next = { ...c }; if (n <= 0) delete next[id]; else next[id] = n; return next; });

  const byId = useMemo(() => Object.fromEntries((data?.products || []).map((p) => [p.id, p])), [data]);
  const lines = Object.entries(cart).filter(([id]) => byId[id]).map(([id, qty]) => ({ p: byId[id], qty }));
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.p.price * l.qty, 0);

  const chooseTab = (t) => { setTab(t); setBrand('Semua'); };

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <p className="font-display text-xl font-extrabold">Menu belum bisa dimuat</p>
          <p className="mt-1 text-sm text-ink/70">{error}</p>
          <button onClick={load} className="mt-4 rounded-xl bg-leaf px-5 py-2.5 font-semibold text-white">Coba lagi</button>
        </div>
      </main>
    );
  }

  if (data && active.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div className="max-w-sm">
          <h1 className="font-display text-3xl font-extrabold">Semua Kloter PO Sedang Tutup</h1>
          <p className="mt-2 text-ink/70">PO berikutnya akan dibuka lagi. Tanya jadwalnya langsung ke kami.</p>
          <a href={`https://wa.me/${WA_NUMBER}`} target="_blank" rel="noreferrer"
            className="mt-6 inline-block rounded-2xl bg-[#1FA855] px-6 py-3 font-bold text-white">Hubungi via WhatsApp</a>
        </div>
      </main>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl pb-28">
      <header className="px-4 pb-3 pt-6 sm:px-6">
        <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">Pre-Order Oleh-oleh Bandung</h1>
        <div className="mt-3 space-y-2">
          {!data && <div className="h-14 animate-pulse rounded-2xl bg-leaf-soft" />}
          {active.map((r) => (
            <div key={r.region_id} className="rounded-2xl bg-leaf px-4 py-3 text-sm text-white">
              <p className="font-display text-base font-bold">{r.title || r.region_id}</p>
              {r.close_date && <p>PO tutup {fmtDate(r.close_date)}</p>}
              {r.delivery_info && <p className="text-white/85">{r.delivery_info}</p>}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => setGuide(true)} className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold">Cara pesan</button>
          <a href={requestLink} target="_blank" rel="noreferrer" className="rounded-xl border border-[#1FA855] bg-white px-4 py-2 text-sm font-semibold text-[#14803E]">Request / titip barang lain</a>
        </div>
      </header>

      <div className="sticky top-0 z-30 space-y-2 border-b border-line bg-mist/95 px-4 py-3 backdrop-blur sm:px-6">
        {both && (
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-white p-1 text-sm font-semibold">
            {[['ALL', 'Semua Menu'], ['BANDUNG', 'PO Bandung'], ['HOMEMADE', 'Homemade']].map(([id, label]) => (
              <button key={id} onClick={() => chooseTab(id)}
                className={`rounded-lg py-2 ${tab === id ? 'bg-leaf text-white' : 'text-ink/70'}`}>{label}</button>
            ))}
          </div>
        )}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari menu, brand, atau kategori"
          className="w-full rounded-xl border border-line bg-white px-4 py-2.5 outline-none focus:border-leaf" />
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {brands.map((b) => (
            <button key={b} onClick={() => setBrand(b)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${brand === b ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}>{b}</button>
          ))}
        </div>
      </div>

      <main className="px-4 pt-4 sm:px-6">
        {!data ? <Skeleton /> : shown.length === 0 ? (
          <div className="py-16 text-center text-ink/60">
            <p>Tidak ada menu yang cocok. Coba kata kunci lain.</p>
            <a href={requestLink} target="_blank" rel="noreferrer" className="mt-3 inline-block font-semibold text-leaf underline">Titip lewat WhatsApp</a>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {shown.map((p) => <ProductCard key={p.id} p={p} qty={cart[p.id] || 0} onChange={setQty} />)}
          </div>
        )}
      </main>

      {count > 0 && (
        <button onClick={() => setOpen(true)}
          className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-xl items-center justify-between rounded-2xl bg-ink px-5 py-3.5 text-white shadow-lg">
          <span className="text-sm font-semibold">{count} item di keranjang</span>
          <span className="font-display text-base font-extrabold">{rupiah(total)}</span>
        </button>
      )}

      {guide && <GuideModal regions={active} onClose={closeGuide} />}
      {open && <CartDrawer lines={lines} regionTitles={regionTitles} waNumber={WA_NUMBER} onChange={setQty} onClose={() => setOpen(false)} />}
    </div>
  );
}
