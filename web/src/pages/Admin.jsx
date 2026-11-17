import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ACTIONS, clearCache, getAdminCatalog, post, verifyPin } from '../lib/api';
import { rupiah, toInputDate } from '../lib/format';
import { compressImage } from '../lib/image';

const CATEGORIES = ['Risol & Camilan', 'Bolen', 'Brownies', 'Pastry', 'Cheesecuit', 'Dessert Box', 'Cake', 'Kue Kering', 'Camilan', 'Hampers'];
const REGIONS = ['HOMEMADE', 'BANDUNG'];
const PAGE = 40;
const inputCls = 'w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none focus:border-leaf';

const Field = ({ label, children }) => (
  <label className="block text-sm font-semibold">{label}<div className="mt-1 font-normal">{children}</div></label>
);

/* ---------- Login ---------- */
function Login({ onLogin, checking }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await verifyPin(pin); sessionStorage.setItem('admin_pin', pin); onLogin(pin); }
    catch (ex) { setErr(ex.message || 'Password salah'); }
    finally { setBusy(false); }
  };
  if (checking) return <main className="grid min-h-screen place-items-center text-ink/60">Memeriksa sesi…</main>;
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-line bg-white p-6">
        <h1 className="font-display text-2xl font-extrabold">Admin PO</h1>
        <p className="mt-1 text-sm text-ink/60">Masukkan password untuk mengelola menu dan kloter.</p>
        <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Password" autoFocus className={`${inputCls} mt-4`} />
        {err && <p className="mt-2 text-sm font-medium text-red-600">{err}</p>}
        <button disabled={busy || !pin} className="mt-4 w-full rounded-xl bg-leaf py-3 font-bold text-white disabled:opacity-50">{busy ? 'Memeriksa…' : 'Masuk'}</button>
        <Link to="/" className="mt-4 block text-center text-sm font-semibold text-leaf">Lihat web pembeli</Link>
      </form>
    </main>
  );
}

/* ---------- Kloter PO ---------- */
function RegionCard({ region, pin, onSaved, toast }) {
  const [active, setActive] = useState(region.is_active);
  const [date, setDate] = useState(toInputDate(region.close_date));
  const [info, setInfo] = useState(region.delivery_info);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await post({ pin, action: ACTIONS.toggleRegion, region_id: region.region_id, is_active: active, close_date: date, delivery_info: info });
      clearCache(); toast('Kloter ' + region.region_id + ' disimpan'); onSaved();
    } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  };
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-lg font-extrabold">{region.region_id === 'BANDUNG' ? 'PO Bandung' : 'Homemade'}</p>
          <p className={`text-sm font-semibold ${active ? 'text-leaf' : 'text-ink/50'}`}>{active ? 'Dibuka' : 'Ditutup'}</p>
        </div>
        <button role="switch" aria-checked={active} onClick={() => setActive(!active)}
          className={`relative h-8 w-14 rounded-full transition ${active ? 'bg-leaf' : 'bg-line'}`}>
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${active ? 'left-7' : 'left-1'}`} />
        </button>
      </div>
      <div className="mt-3 space-y-3">
        <Field label="Tanggal tutup PO"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field>
        <Field label="Info pengiriman"><textarea rows={2} value={info} onChange={(e) => setInfo(e.target.value)} className={inputCls} placeholder="Contoh: Dikirim Sabtu, 20 Nov, area Bandung kota" /></Field>
        <button onClick={save} disabled={busy} className="w-full rounded-xl bg-ink py-2.5 font-semibold text-white disabled:opacity-50">{busy ? 'Menyimpan…' : 'Simpan kloter'}</button>
      </div>
    </div>
  );
}

/* ---------- Form produk (dipakai tambah & edit) ---------- */
function ProductForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [f, setF] = useState({
    region: 'HOMEMADE', name: '', brand: 'Homemade', category: 'Risol & Camilan', price: '', shelf_life: '', is_available: true, ...initial,
  });
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const hasCat = CATEGORIES.includes(f.category);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setPhoto(await compressImage(file)); } catch (ex) { setErr(ex.message); }
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) return setErr('Nama produk wajib diisi.');
    setBusy(true); setErr('');
    try { await onSubmit({ ...f, name: f.name.trim(), brand: f.brand.trim() || 'Homemade', price: Number(f.price) || 0 }, photo); }
    catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  const preview = photo?.preview || f.image_url;

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Region"><select value={f.region} onChange={set('region')} className={inputCls}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="Brand"><input value={f.brand} onChange={set('brand')} className={inputCls} /></Field>
      </div>
      <Field label="Nama produk"><input value={f.name} onChange={set('name')} placeholder="Homemade Risol Mayo Smoked Beef" className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kategori">
          <select value={hasCat ? f.category : '__x'} onChange={set('category')} className={inputCls}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            {!hasCat && <option value="__x">{f.category}</option>}
          </select>
        </Field>
        <Field label="Harga (Rp)"><input type="number" inputMode="numeric" min="0" value={f.price} onChange={set('price')} className={inputCls} /></Field>
      </div>
      <Field label="Catatan ketahanan"><input value={f.shelf_life} onChange={set('shelf_life')} placeholder="Tahan 2 hari, simpan di kulkas" className={inputCls} /></Field>
      {'id' in (initial || {}) && (
        <Field label="Status stok">
          <select value={String(f.is_available)} onChange={(e) => setF((s) => ({ ...s, is_available: e.target.value === 'true' }))} className={inputCls}>
            <option value="true">Tersedia</option><option value="false">Habis</option>
          </select>
        </Field>
      )}
      <Field label={'id' in (initial || {}) ? 'Ganti foto (opsional)' : 'Foto produk'}>
        <input type="file" accept="image/*" onChange={pick} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-leaf-soft file:px-3 file:py-2 file:font-semibold file:text-leaf-dark" />
      </Field>
      {preview && <img src={preview} alt="" className="h-28 w-28 rounded-xl border border-line object-cover" />}
      {err && <p className="text-sm font-medium text-red-600">{err}</p>}
      <div className="flex gap-2">
        {onCancel && <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-line py-2.5 font-semibold">Batal</button>}
        <button disabled={busy} className="flex-1 rounded-xl bg-leaf py-2.5 font-bold text-white disabled:opacity-50">{busy ? 'Menyimpan…' : submitLabel}</button>
      </div>
    </form>
  );
}

/* ---------- Halaman Admin ---------- */
export default function Admin() {
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(!!sessionStorage.getItem('admin_pin'));
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState('Semua');
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState(null);

  const toast = (text, bad = false) => { setMsg({ text, bad }); setTimeout(() => setMsg(null), 3500); };
  const logout = () => { sessionStorage.removeItem('admin_pin'); setPin(''); setData(null); };

  const refresh = useCallback(async (p) => {
    try { setData(await getAdminCatalog(p)); } catch (e) { toast(e.message, true); }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_pin');
    if (!saved) return;
    verifyPin(saved).then(() => { setPin(saved); }).catch(logout).finally(() => setChecking(false));
  }, []);
  useEffect(() => { if (pin) refresh(pin); }, [pin, refresh]);

  const brands = useMemo(() => ['Semua', ...new Set((data?.products || []).map((p) => p.brand).filter(Boolean))], [data]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.products || []).filter((p) =>
      (brand === 'Semua' || p.brand === brand) && (!s || `${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(s)));
  }, [data, q, brand]);

  const mutate = async (body, okText) => {
    await post({ pin, ...body });
    clearCache(); await refresh(pin); toast(okText);
  };

  const add = async (f, photo) => {
    await mutate({
      action: ACTIONS.add, region: f.region, name: f.name, brand: f.brand, category: f.category, price: f.price, shelf_life: f.shelf_life,
      image_base64: photo?.base64 || '', image_name: photo?.name || '',
    }, 'Produk ditambahkan');
  };
  const edit = async (f, photo) => {
    await mutate({
      action: ACTIONS.edit, id: f.id, region: f.region, name: f.name, brand: f.brand, category: f.category, price: f.price,
      shelf_life: f.shelf_life, image_url: f.image_url || '', image_base64: photo?.base64 || '', image_name: photo?.name || '',
      is_available: f.is_available,
    }, 'Perubahan disimpan');
    setEditing(null);
  };
  const toggleStock = (p) => mutate({
    action: ACTIONS.edit, id: p.id, region: p.region, name: p.name, brand: p.brand, category: p.category, price: p.price,
    shelf_life: p.shelf_life, image_url: p.image_url, image_base64: '', image_name: '', is_available: !p.is_available,
  }, p.is_available ? 'Ditandai habis' : 'Ditandai tersedia').catch((e) => toast(e.message, true));
  const remove = (p) => {
    if (!window.confirm(`Hapus "${p.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    mutate({ action: ACTIONS.remove, id: p.id }, 'Produk dihapus').catch((e) => toast(e.message, true));
  };

  if (!pin) return <Login checking={checking} onLogin={setPin} />;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-5 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">Admin PO</h1>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Link to="/" className="rounded-lg border border-line bg-white px-3 py-2 text-leaf">Lihat web pembeli</Link>
          <button onClick={logout} className="rounded-lg bg-ink px-3 py-2 text-white">Logout</button>
        </div>
      </header>

      {msg && <div className={`fixed inset-x-4 top-4 z-50 mx-auto max-w-md rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${msg.bad ? 'bg-red-600' : 'bg-leaf-dark'}`}>{msg.text}</div>}

      <section className="mt-6">
        <h2 className="font-display text-lg font-extrabold">Kloter PO</h2>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {data ? ['BANDUNG', 'HOMEMADE'].map((id) => {
            const r = data.regions.find((x) => x.region_id === id);
            return <RegionCard key={id + JSON.stringify(r)} region={r} pin={pin} toast={toast} onSaved={() => refresh(pin)} />;
          }) : <p className="text-sm text-ink/60">Memuat…</p>}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-extrabold">Tambah produk</h2>
        <div className="mt-2 rounded-2xl border border-line bg-white p-4"><ProductForm key={data?.products.length} submitLabel="Simpan produk" onSubmit={add} /></div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-extrabold">Semua produk ({filtered.length})</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_220px]">
          <input value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Cari produk" className={inputCls} />
          <select value={brand} onChange={(e) => { setBrand(e.target.value); setLimit(PAGE); }} className={inputCls}>{brands.map((b) => <option key={b}>{b}</option>)}</select>
        </div>
        <div className="mt-3 space-y-2">
          {!data && <p className="text-sm text-ink/60">Memuat produk…</p>}
          {filtered.slice(0, limit).map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3">
              {p.image_url ? <img src={p.image_url} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg object-cover" /> : <div className="h-14 w-14 shrink-0 rounded-lg bg-leaf-soft" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.name}</p>
                <p className="truncate text-xs text-ink/60">{p.id} · {p.region} · {p.brand} · {rupiah(p.price)}</p>
                <span className={`mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${p.is_available ? 'bg-leaf-soft text-leaf-dark' : 'bg-red-100 text-red-700'}`}>{p.is_available ? 'Tersedia' : 'Habis'}</span>
              </div>
              <div className="flex shrink-0 flex-col gap-1 text-xs font-semibold sm:flex-row">
                <button onClick={() => setEditing(p)} className="rounded-lg border border-line px-2.5 py-1.5">Edit</button>
                <button onClick={() => toggleStock(p)} className="rounded-lg border border-line px-2.5 py-1.5">{p.is_available ? 'Set habis' : 'Set ada'}</button>
                <button onClick={() => remove(p)} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-red-600">Hapus</button>
              </div>
            </div>
          ))}
          {filtered.length > limit && <button onClick={() => setLimit(limit + PAGE)} className="w-full rounded-xl border border-line bg-white py-2.5 text-sm font-semibold">Tampilkan lebih banyak</button>}
        </div>
      </section>

      {editing && (
        <div className="fixed inset-0 z-40 grid place-items-end bg-ink/50 sm:place-items-center" onClick={() => setEditing(null)}>
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-display text-lg font-extrabold">Edit produk</h3>
            <ProductForm initial={editing} submitLabel="Simpan perubahan" onSubmit={edit} onCancel={() => setEditing(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
