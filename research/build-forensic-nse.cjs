const fs = require('fs');
const path = require('path');

const nseSec = JSON.parse(fs.readFileSync('data/nse-equity-securities.json', 'utf8')).securities;
const quotes = JSON.parse(fs.readFileSync('data/company-quotes.json', 'utf8')).quotes;

const months = ['2026-08', '2026-09', '2026-10'];
const summary = {};

for (const [sym, name, isin] of nseSec) {
  if (!quotes[sym]) continue; // track all quoted/active universe stocks (~438 stocks)
  const letter = /^[A-Z]/.test(sym) ? sym[0] : (/[0-9]/.test(sym[0]) ? sym[0] : null);
  if (!letter) continue;
  const byMonth = {};
  for (const mo of months) {
    const p = path.join('public/nse-volume', mo, letter + '.json');
    if (!fs.existsSync(p)) continue;
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    const key = Object.keys(data.securities || {}).find(k => k === sym || k.startsWith(sym + ':'));
    if (!key) continue;
    const rows = data.securities[key];
    if (!Array.isArray(rows) || !rows.length) continue;
    let vol = 0, del = 0;
    for (const r of rows) {
      vol += Number(r[1] || 0);
      del += Number(r[2] || 0);
    }
    if (vol > 0) {
      byMonth[mo] = {
        days: rows.length,
        vol,
        del,
        delPct: Number((del / vol * 100).toFixed(1))
      };
    }
  }
  if (Object.keys(byMonth).length > 0) {
    summary[sym] = { isin, name, months: byMonth };
  }
}

const out = {
  generatedAt: new Date().toISOString(),
  months,
  count: Object.keys(summary).length,
  securities: summary
};

fs.writeFileSync('data/forensic-nse-3m.json', JSON.stringify(out));
console.log('Wrote data/forensic-nse-3m.json:', out.count, 'securities, size:', fs.statSync('data/forensic-nse-3m.json').size, 'bytes');
