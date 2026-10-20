const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpile(fs.readFileSync(f,'utf8'),{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}),f);
const {researchReport}=require('../lib/agent-research.ts');
const {bundledComparisons,readAllFullComparisons,fullKey}=require('../lib/full-portfolio-store.ts');
// Preserve the original two-fund September signal regression; also check the expanded archive.
const originalScope=bundledComparisons.filter(c=>c.currentDate==="2026-08-31"||["dsp","nippon"].includes(c.fundId));
const report=researchReport(originalScope);
assert.equal(researchReport().comparisonCount,bundledComparisons.length);
assert.equal(researchReport().portfolioChanged,true);
assert.equal(report.coverage,20);assert.equal(report.snapshotCount,42);assert.equal(report.comparisonCount,22);assert.equal(report.universe,682);assert.equal(report.portfolioChanged,true);
assert.deepEqual(report.periods.map(p=>[p.month,p.coverage]),[['2026-08',20],['2026-09',2]]);
assert.ok(report.stocks.every(s=>s.fundEvidence));
const nh=report.stocks.find(s=>s.symbol==='NH').fundEvidence;
assert.deepEqual(nh.repeatFunds,['DSP Small Cap Fund']);assert.equal(nh.adding,2);assert.equal(nh.positivePeriods,2);
assert.equal(nh.periods[1].company.funds.find(f=>f.fundId==='dsp').delta,166188);
for(const symbol of ['PRUDENT','KPIL']){const e=report.stocks.find(s=>s.symbol===symbol).fundEvidence;assert.equal(e.repeatFunds.length,0);assert.equal(e.positivePeriods,2);assert.equal(e.adding,3);}
for(const symbol of ['INOXINDIA']){const e=report.stocks.find(s=>s.symbol===symbol).fundEvidence;assert.equal(e.adding,5);assert.equal(e.periods[1].company,null);}
for(const s of report.stocks){for(const block of [...s.sections,...s.growthDrivers])for(const ref of block.refs)assert.ok(s.sources[ref]?.url.startsWith('https://'));}
assert.equal(report.stocks.length,10);
const signal=symbol=>report.stocks.find(s=>s.symbol===symbol).fundEvidence;
assert.deepEqual(signal('KPITTECH').repeatFunds,['DSP Small Cap Fund']);assert.equal(signal('KPITTECH').adding,2);
assert.equal(signal('ECLERX').adding,2);assert.equal(signal('ECLERX').reducing,2);
assert.deepEqual(signal('IPCALAB').repeatFunds,['DSP Small Cap Fund']);assert.equal(signal('IPCALAB').adding,1);
assert.deepEqual(signal('VINATIORGA').repeatFunds,['Nippon India Small Cap Fund']);
assert.equal(signal('VOLTAMP').adding,4);assert.equal(signal('DATAPATTNS').adding,3);
for(const b of report.overview)for(const ref of b.refs)assert.ok(report.marketSources[ref]?.url.startsWith('https://'));
// Corporate-action review remains withheld, and identity cannot match a substring.
const changed=structuredClone(bundledComparisons);const row=changed.find(c=>c.fundId==='dsp'&&c.currentDate==='2026-09-30').rows.find(r=>r.name.includes('Narayana'));
row.note='Corporate action requires review';assert(!researchReport(changed).stocks.find(s=>s.symbol==='NH').fundEvidence.repeatFunds.includes('DSP Small Cap Fund'));assert.equal(researchReport(changed).portfolioChanged,true);
assert.equal(researchReport([...bundledComparisons,...bundledComparisons]).comparisonCount,bundledComparisons.length);
// Paginated archive discovery includes future imported reporting months, independent of selector.
const fresh=structuredClone(bundledComparisons.find(c=>c.fundId==='dsp'&&c.currentDate==='2026-09-30'));
// Validate against an already completed month to avoid constructing a future import.
fresh.currentDate='2026-06-30';fresh.previousDate='2026-05-31';fresh.checkedAt='2026-07-02T00:00:00Z';
let pages=0;
const bucket={list:async({cursor})=>{pages++;return cursor?{objects:[{key:fullKey('2026-06','dsp')}],truncated:false}:{objects:[],truncated:true,cursor:'next'};},get:async key=>key===fullKey('2026-06','dsp')?{json:async()=>fresh}:null};
require('./database-test-runtime.cjs').setup(bucket);
(async()=>{const all=await readAllFullComparisons(bucket);assert.equal(pages,2);assert.equal(all.length,bundledComparisons.length+1);assert.equal(researchReport(all).periods[0].month,'2026-06');assert.equal(researchReport(all).portfolioChanged,true);console.log('All-archive research verification passed: coverage, identity, database persistence, review withholding, sources and paginated legacy imports.');})().catch(e=>{console.error(e);process.exitCode=1;});
