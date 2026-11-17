const assert=require('node:assert/strict');
const bucket={get:async()=>null,list:async()=>({objects:[],truncated:false}),put:async()=>{}};
const runtime=require('./database-test-runtime.cjs').setup(bucket);
const october=require('../data/october-portfolios.json');
const {validateFullComparison,movement}=require('../lib/full-portfolio.ts');
const {validatePortfolio,ids}=require('../lib/portfolio.ts');
const {sharedCompanyHoldings}=require('../lib/fund-search.ts');
const {combinedAnalysis}=require('../lib/combined-analysis.ts');
const store=require('../lib/database-store.ts');
(async()=>{
 for(const comparison of october.comparisons){validateFullComparison(comparison);assert.equal(comparison.currentDate,'2026-10-31');assert.equal(comparison.previousDate,'2026-09-30');for(const row of comparison.rows)if(row.note)assert.equal(movement(row),'review');}
 await store.ensureDatabase();
 const oct=await store.readDatabaseFunds('2026-10'),sep=await store.readDatabaseFunds('2026-09');
 assert.equal(oct.length,october.funds.length);assert.equal(new Set(oct.map(f=>f.id)).size,oct.length);assert(oct.every(f=>f.holdings.length===30&&f.portfolioDate==='2026-10-31'));
 assert.equal(sep.length,ids.length);assert(sep.some(f=>f.id==='quantum'&&f.verification==='official_only'));
 const current=await store.readCurrentPortfolio();validatePortfolio(current);
 const api=require('../app/api/portfolio/route.ts');const headers={'x-fund-update-key':runtime.env.UPDATE_KEY};
 assert.equal((await api.GET(new Request('https://test/api/portfolio?month=2026-10'))).status,401);
 const response=await api.GET(new Request('https://test/api/portfolio?month=2026-10',{headers}));assert.equal(response.status,200);const view=await response.json();
 assert.equal(view.requestedMonth,'2026-10');assert.equal(view.previousMonth,'2026-09');assert.equal(view.funds.length,oct.length);assert.equal(view.previousFunds.length,34);assert.deepEqual(view.missingFunds.slice().sort(),october.pending.map(f=>f.fundId).sort());
 assert.equal(view.fullComparisons.length,oct.length);assert.equal(view.availableMonths[0],'2026-10');
 for(const p of october.pending)assert(!view.funds.some(f=>f.id===p.fundId));
 const shared=sharedCompanyHoldings(view);assert(shared.companies.length>0);assert.equal(shared.fullFunds,oct.length);
 const combined=combinedAnalysis(view.fullComparisons,'2026-10');assert.equal(combined.coverage,oct.length);assert.equal(combined.missingFunds.length,october.pending.length);
 const research=require('../lib/agent-research.ts').researchReport(await store.readDatabaseComparisons());assert.equal(research.fundMonth,'2026-10');assert(research.title.includes('October 2026'));assert.equal(research.deepResearch.months.join(','),'2026-08,2026-09,2026-10');assert(research.newsletter.stories.some(s=>s.label.includes('PERSISTENCE')));assert.equal(research.portfolioChanged,false);
 // Original workbook is authoritative where a provider gives a different SBI position.
 const sbi=october.comparisons.find(c=>c.fundId==='sbi-small');assert.equal(sbi.basis,'official_disclosures');assert.equal(sbi.rows.find(r=>r.key==='INE0LEZ01016').currentQuantity,10000000);
 const first=JSON.stringify(await store.readDatabaseComparisons('2026-10'));await store.ensureDatabase();assert.equal(JSON.stringify(await store.readDatabaseComparisons('2026-10')),first);
 const newer={...sbi,checkedAt:'2026-11-30T00:00:00.000Z',notes:['Later independently saved review']};await store.saveComparison(newer);await store.ensureDatabase();assert.deepEqual((await store.readDatabaseComparisons('2026-10')).find(c=>c.fundId==='sbi-small').notes,newer.notes);
 console.log(`October verified: ${oct.length}/34 funds; authenticated APIs; no month fallback; September preserved; exact SBI primary quantities; shared and combined holdings; refreshed letter; idempotent DB import and newer-record protection.`);
 runtime.sqlite.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
