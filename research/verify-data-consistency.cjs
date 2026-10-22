const assert=require('node:assert/strict'),fs=require('node:fs');
const runtime=require('./database-test-runtime.cjs').setup({get:async()=>null,list:async()=>({objects:[],truncated:false})});
(async()=>{
 const {GET}=require('../app/api/portfolio/route.ts');
 const {allCompanyHoldings,searchCompanyHoldings,sharedCompanyHoldings}=require('../lib/fund-search.ts');
 const {combinedAnalysis}=require('../lib/combined-analysis.ts');
 const {companyKey}=require('../lib/top-holdings.ts');
 const {companyIdentity}=require('../lib/company-identity.ts');
 const summaries=[];
 for(const month of ['2026-08','2026-09']){
  const response=await GET(new Request('https://test/api/portfolio?month='+month,{headers:{'x-fund-update-key':runtime.env.UPDATE_KEY}}));assert.equal(response.status,200);
  const data=await response.json(),rows=allCompanyHoldings(data),combined=combinedAnalysis(data.fullComparisons,month);
  assert.equal(new Set(rows.map(r=>r.fundId+':'+r.companyId)).size,rows.length,'One company per fund');
  for(const c of combined.companies){
   const matches=rows.filter(row=>companyKey(row.name)===companyKey(c.name));
   for(const fund of c.funds.filter(f=>f.currentQuantity>0))assert(matches.some(row=>row.fundId===fund.fundId),month+': '+c.name+' in '+fund.name+' must appear in search');
   assert.equal(c.currentQuantity,c.funds.reduce((sum,f)=>sum+f.currentQuantity,0));
   if(c.delta!==null)assert.equal(c.delta,c.currentQuantity-c.previousQuantity);
  }
  for(const r of rows){assert(r.weight===null||(Number.isFinite(r.weight)&&r.weight>=0&&r.weight<=100));if(r.change!==null)assert.equal(r.change,Math.round((r.weight-r.previousWeight)*100)/100);}
  for(const shared of sharedCompanyHoldings(data).companies)assert.equal(new Set(shared.funds.map(f=>f.id)).size,shared.funds.length);
  summaries.push({month,funds:data.funds.length,fullComparisons:data.fullComparisons.length,currentPositions:rows.length,comparisonCompanies:combined.companies.length,reviewPositions:combined.reviewPositions});
  if(month==='2026-09'){
   const indo=combined.companies.find(c=>companyKey(c.name)===companyKey('Indo-MIM Limited'));
   assert.equal(indo.funds.filter(f=>f.currentQuantity>0).length,8);assert.equal(indo.funds.filter(f=>f.status==='exited').length,2);
   assert.equal(searchCompanyHoldings(data,'indo mim').length,8);
   for(const name of ['Federal Bank','Indian Hotels','CDSL','Kirloskar Pneumatic'])assert(searchCompanyHoldings(data,name).length>0,name+' alias remains searchable');
   const c=data.fullComparisons.find(c=>c.fundId==='abakkus'),h=c.rows.find(r=>r.name.includes('Indo-MIM'));assert.equal(h.currentQuantity,53110);assert.equal(h.previousQuantity,103110);assert.equal(h.weight,.2);
  }
 }
 const identity=companyIdentity([{name:'Example Company Ltd',key:'INE000000001'},{name:'Example Co Limited',key:'INE000000001'},{name:'Example Company Services Ltd',key:'INE000000002'}]);
 assert.equal(identity({name:'Example Co Limited'}).id,identity({name:'Example Company Ltd'}).id);
 assert.notEqual(identity({name:'Example Company Services Ltd'}).id,identity({name:'Example Company Ltd'}).id,'No substring or fuzzy identity joins');
 const store=require('../lib/database-store.ts'),all=await store.readDatabaseComparisons();let linkedRows=0;
 for(const c of all){const prev=all.find(p=>p.fundId===c.fundId&&p.currentDate===c.previousDate);if(!prev)continue;for(const row of c.rows){const old=prev.rows.find(r=>r.key===row.key);if(old&&row.previousQuantity!==null){assert.equal(row.previousQuantity,old.currentQuantity,c.fundId+': '+row.name+' prior shares');linkedRows++;}}}
 const report={scope:'Bundled database integration and cross-view consistency, not a fresh verification of every original filing.',summaries,linkedRows};
 fs.writeFileSync('research/data-consistency-audit-2026-10-22.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
