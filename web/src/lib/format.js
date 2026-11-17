export const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

// close_date dari Sheets bisa berupa "2026-11-20" atau ISO penuh -> ambil bagian tanggalnya
export const toInputDate = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(0, 10) : '');

export const fmtDate = (v) => {
  const d = toInputDate(v);
  if (!d) return String(v || '');
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
};
