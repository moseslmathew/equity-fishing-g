const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpile(fs.readFileSync(f,'utf8'),{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}),f);
const {fiiQuarters,fiiHistory}=require('../lib/fii-quarterly.ts');
assert.deepEqual(fiiQuarters('2026-09').map(q=>q.key),['2025-12','2026-03','2026-06','2026-09']);
assert.deepEqual(fiiQuarters('2026-08').map(q=>q.key),['2025-09','2025-12','2026-03','2026-06']);
assert.deepEqual(fiiQuarters('2026-01').map(q=>q.key),['2025-03','2025-06','2025-09','2025-12']);
assert.deepEqual(fiiQuarters('2030-12'),fiiQuarters('2026-10'));
assert.equal(fiiHistory('Multi Commodity Exchange of India Ltd.').quarters['2026-09'],27.06);
assert.equal(fiiHistory('City Union Bank Ltd').quarters['2026-09'],17.39);
assert.equal(fiiHistory('An unknown unlisted business'),null);
const snapshot=require('../data/fii-quarterly.json');
for(const [symbol,history] of Object.entries(snapshot.securities)){
  if(symbol==='HARSHA')assert.equal(history.source,'https://www.screener.in/company/id/1275304/#shareholding');
  else assert.match(history.source,new RegExp('^https://www\\.screener\\.in/company/'+encodeURIComponent(symbol).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'/'));
  for(const [quarter,value] of Object.entries(history.quarters)){
    assert.match(quarter,/^20\d\d-(03|06|09|12)$/);
    assert.ok(value===null||(Number.isFinite(value)&&value>=0&&value<=100));
  }
}
console.log('FII checks passed: quarter alignment, year boundary, future cutoff, security identity, missing values and all imported percentages.');
