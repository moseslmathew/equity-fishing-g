const assert=require('node:assert/strict'),fs=require('node:fs');
const runtime=require('./database-test-runtime.cjs').setup({get:async()=>null,list:async()=>({objects:[],truncated:false})});
(async()=>{
 const imported=require('../data/september-portfolios.json'),baseline=require('../data/seed.json'),{validatePortfolio}=require('../lib/portfolio.ts'),{validateFullComparison}=require('../lib/full-portfolio.ts');
 const {fundCatalog}=require('../lib/fund-catalog.ts');
 const expansion=require('../data/fund-expansion-2026-10.json');
 validatePortfolio({...baseline,funds:[...baseline.funds.map(f=>imported.funds.find(n=>n.id===f.id)??f),...expansion.funds.filter(f=>f.portfolioDate==='2026-09-30')]});
 for(const c of imported.comparisons){validateFullComparison(c);assert.equal(c.currentDate,'2026-09-30');assert.equal(c.previousDate,'2026-08-31');const f=imported.funds.find(f=>f.id===c.fundId);assert(f);const top=c.rows.filter(r=>r.currentQuantity>0).sort((a,b)=>b.weight-a.weight).slice(0,15);assert.deepEqual(f.holdings.map(h=>[h.key,h.weight]),top.map(r=>[r.key,r.weight]));}
 const store=require('../lib/database-store.ts');await store.ensureDatabase();
 // Existing production database: legacy migration already complete, September rows missing.
 runtime.sqlite.prepare("DELETE FROM fund_snapshots WHERE month='2026-09'").run();runtime.sqlite.prepare("DELETE FROM fund_comparisons WHERE month='2026-09'").run();runtime.sqlite.prepare("DELETE FROM app_documents WHERE key LIKE 'import:september-2026:%' OR key LIKE 'import:fund-expansion-2026-10:%'").run();
 const {monthlyPortfolio}=require('../lib/monthly.ts');const latest=await monthlyPortfolio(runtime.env.BUCKET,baseline,baseline,'latest');assert.equal(latest.requestedMonth,'2026-09');assert.equal(latest.funds.length,fundCatalog.length);assert.equal(latest.fullComparisons.length,imported.comparisons.length+expansion.comparisons.length);assert.equal(latest.missingFunds.length,0);assert.equal(latest.previousFunds.length,fundCatalog.length);
 const historical=await monthlyPortfolio(runtime.env.BUCKET,baseline,baseline,'2026-08');assert.equal(historical.funds.length,fundCatalog.length);assert.equal(historical.fullComparisons.length,20);
 const count=runtime.sqlite.prepare('SELECT count(*) n FROM fund_snapshots').get().n;await store.ensureDatabase();assert.equal(runtime.sqlite.prepare('SELECT count(*) n FROM fund_snapshots').get().n,count);
 const newer=structuredClone(imported.comparisons[0]);newer.checkedAt='2099-01-01T00:00:00Z';newer.notes.push('Later verified update');await store.saveComparison(newer);runtime.sqlite.prepare("DELETE FROM app_documents WHERE key LIKE 'import:september-2026:%' OR key LIKE 'import:fund-expansion-2026-10:%'").run();await store.ensureDatabase();assert.deepEqual((await store.readDatabaseComparisons('2026-09')).find(c=>c.fundId===newer.fundId),newer);
 const ui=fs.readFileSync('app/fund-browser.tsx','utf8');assert(ui.includes('sort((a,b)=>a.name.localeCompare(b.name,"en-IN"))'));
 console.log('September refresh passed: validated top15 and full comparisons, existing-database backfill, August preservation, idempotency, later-data protection, alphabetical card/table order.');
})().catch(e=>{console.error(e);process.exitCode=1;});
