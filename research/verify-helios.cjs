const assert=require('node:assert/strict'),fs=require('node:fs');
const runtime=require('./database-test-runtime.cjs').setup({get:async()=>null,list:async()=>({objects:[],truncated:false})});
(async()=>{
 const {fundCatalog,schemeCategories}=require('../lib/fund-catalog.ts'),{validatePortfolio}=require('../lib/portfolio.ts'),seed=require('../data/seed.json'),sep=require('../data/september-portfolios.json');
 const names=['Helios Financial Services Fund','Helios Flexi Cap Fund','Helios Large & Mid Cap Fund','Helios Mid Cap Fund','Helios Small Cap Fund'];
 const sorted=[...fundCatalog].sort((a,b)=>a.name.localeCompare(b.name,'en-IN')),group=sorted.filter(f=>f.name.startsWith('Helios '));assert.deepEqual(group.map(f=>f.name),names);assert.equal(sorted.indexOf(group[4])-sorted.indexOf(group[0]),4);assert.equal(fundCatalog.length,24);
 assert.equal(schemeCategories.helios,'Small cap');assert.equal(schemeCategories['helios-mid'],'Mid cap');assert.equal(schemeCategories['helios-flexi'],'Flexi cap');assert.equal(schemeCategories['helios-large-mid'],'Large & mid cap');assert(schemeCategories['helios-financial'].includes('Sector'));
 validatePortfolio(seed);assert.equal(sep.funds.length,24);
 const store=require('../lib/database-store.ts');await store.ensureDatabase();
 const original=await store.readDatabaseFunds('2026-09');
 // Reproduce an existing deployment missing the four newly requested schemes.
 runtime.sqlite.prepare("DELETE FROM fund_snapshots WHERE fund_id LIKE 'helios-%'").run();runtime.sqlite.prepare("DELETE FROM fund_comparisons WHERE fund_id LIKE 'helios-%'").run();runtime.sqlite.prepare("DELETE FROM app_documents WHERE key LIKE 'import:september-2026:%'").run();await store.ensureDatabase();
 const current=await store.readDatabaseFunds('2026-09'),previous=await store.readDatabaseFunds('2026-08');assert.equal(current.length,24);assert.equal(previous.length,24);
 for(const f of group){assert.equal(current.find(x=>x.id===f.id).holdings.length,15);assert.equal(previous.find(x=>x.id===f.id).holdings.length,15);}
 assert.deepEqual(current.find(f=>f.id==='helios'),original.find(f=>f.id==='helios'));
 const response=await require('../app/api/portfolio/route.ts').GET(new Request('https://test/api/portfolio?month=2026-09',{headers:{'x-fund-update-key':runtime.env.UPDATE_KEY}}));assert.equal(response.status,200);assert.equal((await response.json()).funds.length,24);
 console.log('Helios verified: five consecutive named equity schemes, correct categories, dated top15, existing-database backfill and preservation of original Small Cap history.');
})().catch(e=>{console.error(e);process.exitCode=1;});
