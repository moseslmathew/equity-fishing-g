const assert=require('node:assert/strict');
const runtime=require('./database-test-runtime.cjs').setup({get:async()=>null,list:async()=>({objects:[],truncated:false})});
(async()=>{
 const {GET}=require('../app/api/portfolio/route.ts');
 const {validatePortfolio,changesBetween}=require('../lib/portfolio.ts');
 const {withTopHoldings,companyKey}=require('../lib/top-holdings.ts');
 const {searchCompanyHoldings,sharedCompanyHoldings}=require('../lib/fund-search.ts');
 const response=await GET(new Request('https://test/api/portfolio?month=2026-09',{headers:{'x-fund-update-key':runtime.env.UPDATE_KEY}}));
 assert.equal(response.status,200);const data=await response.json();validatePortfolio(data);
 const store=require('../lib/database-store.ts'),saved=await store.readDatabaseFunds('2026-09');
 assert.equal(data.funds.length,34);
 for(const f of data.funds){
  assert.equal(f.holdings.length,30,f.id);
  assert.equal(new Set(f.holdings.map(h=>h.key)).size,30);
  assert(f.holdings.every((h,i)=>i===0||h.weight<=f.holdings[i-1].weight));
  const original=saved.find(x=>x.id===f.id);
  for(const old of original.holdings)assert.deepEqual(f.holdings.find(h=>h.key===old.key),old,'Saved allocations preserved');
  assert(searchCompanyHoldings(data,f.holdings[29].name).some(h=>h.fundId===f.id),'Rank 30 is searchable');
 }
 const sample=saved.find(f=>f.id==='abakkus'),comparison=data.fullComparisons.find(c=>c.fundId===sample.id);
 assert.equal(withTopHoldings(sample,{...comparison,currentDate:'2026-07-31',previousDate:'2026-06-30'}),sample,'Never use another month');
 assert.equal(withTopHoldings(sample,{...comparison,rows:comparison.rows.map((r,i)=>i===0?{...r,weight:null}:r)}),sample,'Do not rank incomplete weights');
 assert.equal(withTopHoldings(sample,{...comparison,rows:comparison.rows.map(r=>({...r,weight:0}))}),sample,'Conflicting original allocations are retained');
 assert(!changesBetween({...data,funds:saved},data).some(x=>/entered|left/.test(x)),'Display expansion is not an entry or exit');
 assert.equal(data.fullComparisons.length,33,'No quantities fabricated for Quantum');
 assert.equal(data.funds.find(f=>f.id==='quantum').holdingsEvidence.basis,'published_allocations');
 assert.equal(sharedCompanyHoldings(data).fullFunds,33);
 const history=await (await GET(new Request('https://test/api/portfolio?month=2026-08',{headers:{'x-fund-update-key':runtime.env.UPDATE_KEY}}))).json();
 assert.equal(history.funds.filter(f=>f.holdings.length===30).length,33);
 assert.equal(history.funds.find(f=>f.id==='helios-financial').holdings.length,15,'Unreconciled history remains partial');
 console.log('Verified top 30 for all 34 September funds; preserved allocations, search, shared holdings, safe ranking, 33 August funds, legacy validation and no false entry/exit events.');
})().catch(e=>{console.error(e);process.exitCode=1;});
