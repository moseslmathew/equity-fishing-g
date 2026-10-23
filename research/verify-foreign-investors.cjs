const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.css']=()=>{};
const Module=require('node:module'),path=require('node:path'),resolve=Module._resolveFilename;Module._resolveFilename=function(id,...args){return resolve.call(this,id.startsWith('@/')?path.join(process.cwd(),id.slice(2)):id,...args);};
const runtime=require('./database-test-runtime.cjs').setup({get:async()=>null,list:async()=>({objects:[],truncated:false})});
require.extensions['.tsx']=(m,f)=>m._compile(ts.transpile(fs.readFileSync(f,'utf8'),{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}),f);
(async()=>{
 const data=require('../data/foreign-investors.json'),logic=require('../lib/foreign-investors.ts');logic.validateForeignResearch(data);
 assert.equal(data.companies.length,38);assert.equal(data.events.length,37);
 const base={query:'',listing:'all',stance:'all',period:'all',sort:'name'},select=p=>logic.selectForeignCompanies(data,{...base,...p});
 assert.equal(select({query:'Federal'}).length,1);assert.equal(select({query:'none-this-does-not-exist'}).length,0);
 assert(select({listing:'listed'}).every(c=>c.listing.startsWith('Listed')));assert(select({stance:'exited'}).some(c=>c.id==='epl'));
 assert.equal(select({sort:'stake'})[0].id,'igi');assert(select({period:'year'}).every(c=>!['kolte','simplilearn','xpressbees','taskus'].includes(c.id)));
 const company=id=>data.companies.find(c=>c.id===id);assert.equal(company('federal').stakePercent,null);assert.equal(company('mphasis').stakePercent,30.53);assert.equal(company('novigo').stakePercent,null);assert.equal(company('rcb').stakePercent,null);assert.equal(company('epl').stance,'exited');
 assert.equal(data.events.find(e=>e.id==='sageone-sign').status,'Announced');assert.equal(data.events.find(e=>e.id==='ace-report').status,'Timing uncertain');assert.equal(data.events.find(e=>e.id==='horizon-ipo').direction,'reduced');
 const auth=require('../lib/access.ts'),store=require('../lib/foreign-investor-store.ts'),api=require('../app/api/foreign-investors/route.ts');
 assert.equal((await api.GET(new Request('https://test/api/foreign-investors'))).status,401);
 assert.equal((await api.GET(new Request('https://test/api/foreign-investors?id=unknown',{headers:{'x-fund-update-key':runtime.env.UPDATE_KEY}}))).status,404);
 let response=await api.GET(new Request('https://test/api/foreign-investors',{headers:{'x-fund-update-key':runtime.env.UPDATE_KEY}}));assert.equal(response.status,200);assert.equal((await response.json()).companies.length,38);assert.equal(response.headers.get('cache-control'),'private, no-store');
 const row=runtime.sqlite.prepare("SELECT payload FROM app_documents WHERE key='foreign-investor:blackstone'").get();assert(row);assert.equal(JSON.parse(row.payload).events.length,37);
 // A newly published bundled review must never overwrite newer database research.
 const newer={...data,checkedAt:'2026-10-16T00:00:00.000Z',coverage:'Newer reviewed snapshot'};await require('../lib/database-store.ts').database().batch([require('../lib/database-store.ts').documentStatement(runtime.db,'foreign-investor:blackstone',newer,newer.checkedAt)]);assert.equal((await store.readForeignResearch()).coverage,'Newer reviewed snapshot');
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),Foreign=require('../app/foreign-investors.tsx').default;
 const datasets=[];
 for(const id of store.foreignInvestorIds){
  const snapshot=await store.readForeignResearch(id);assert.equal(snapshot?.id,id);datasets.push(snapshot);
  const result=await api.GET(new Request('https://test/api/foreign-investors?id='+id,{headers:{'x-fund-update-key':runtime.env.UPDATE_KEY}}));assert.equal(result.status,200);assert.equal((await result.json()).id,id);
  assert(runtime.sqlite.prepare('SELECT payload FROM app_documents WHERE key=?').get('foreign-investor:'+id));
  const rendered=renderToStaticMarkup(React.createElement(Foreign,{datasets:[snapshot]}));assert(rendered.includes(snapshot.name));assert(rendered.includes(snapshot.companies.length+' companies / platforms'));
 }
 const cpp=datasets.find(d=>d.id==='cpp-investments'),brookfield=datasets.find(d=>d.id==='brookfield'),adia=datasets.find(d=>d.id==='adia'),kkr=datasets.find(d=>d.id==='kkr');
 assert.equal(cpp.companies.find(c=>c.id==='ctrls').stakePercent,8.2);
 assert.equal(cpp.companies.find(c=>c.id==='ctrls-campus-jv').stakePercent,48);
 assert(cpp.companies.filter(c=>c.id.startsWith('ctrls')).every(c=>c.stance==='proposed'),'Agreement terms are not proof of closing');
 assert.equal(cpp.companies.find(c=>c.id==='indospace-core').stakePercent,93);
 assert.equal(brookfield.companies.find(c=>c.id==='altius').stakePercent,null,'A co-investor transaction percentage is not Brookfield ownership');
 assert.equal(brookfield.companies.find(c=>c.id==='brookfield-india-reit').stakePercent,null,'Sponsorship does not mean full ownership');
 assert.equal(adia.companies.find(c=>c.id==='lenskart').stance,'reduced');
 assert.equal(adia.companies.find(c=>c.id==='lenskart').stakePercent,null,'Shares sold do not establish retained ownership');
 assert.equal(adia.companies.find(c=>c.id==='idfc-first').stakePercent,null);
 assert.equal(kkr.companies.find(c=>c.id==='cisternina').stance,'proposed');
 assert.equal(kkr.companies.find(c=>c.id==='hcg').stakePercent,null,'Agreement percentage must not be promoted to a current holding');
 const aggregate=logic.aggregateForeignResearch(datasets);logic.validateForeignResearch(aggregate);
 assert.equal(aggregate.companies.length,datasets.reduce((sum,d)=>sum+d.companies.length,0));
 assert.equal(new Set(aggregate.companies.map(c=>c.id)).size,aggregate.companies.length,'Investor-specific company records cannot collide');
 assert.equal(new Set(aggregate.events.map(e=>e.id)).size,aggregate.events.length);
 for(const d of datasets)for(const c of d.companies){const a=aggregate.companies.find(a=>a.id===d.id+':'+c.id);assert.equal(a.investorName,d.name);assert.equal(a.ownership,c.ownership);assert.equal(a.ownershipDate,c.ownershipDate);assert.equal(a.stakePercent,c.stakePercent);assert.deepEqual(a.sourceIds.map(id=>aggregate.sources[id]),c.sourceIds.map(id=>d.sources[id]));}
 for(const query of ['Ather','Federal','bank','health','CtrlS','Allfleet','Lenskart','Altius','no-such-company-xyz']){const expected=datasets.flatMap(d=>logic.selectForeignCompanies(d,{...base,query}));assert.equal(logic.selectForeignCompanies(aggregate,{...base,query}).length,expected.length);}
 assert(logic.selectForeignCompanies(aggregate,{...base,listing:'listed'}).every(c=>c.listing.startsWith('Listed')));
 const html=renderToStaticMarkup(React.createElement(Foreign,{datasets}));assert(html.includes('Research brief'));assert(html.includes('Past-year activity'));assert(html.includes('Blackstone'));assert(html.includes('38 companies / platforms'));
 const originalLoad=Module._load;
 const cookie=auth.sessionCookie+'='+await auth.createSession();
 Module._load=function(id,...args){return id==='next/headers'?{headers:async()=>new Headers({cookie})}:originalLoad.call(this,id,...args);};
 const page=await require('../app/foreign-investors/page.tsx').default();
 assert.equal(page.props.datasets.length,8);assert(renderToStaticMarkup(page).includes('BlackRock'));for(const name of ['KKR','Brookfield','ADIA','CPP Investments'])assert(renderToStaticMarkup(page).includes(name));
 const blackrock=datasets.find(item=>item.id==='blackrock');assert.equal(blackrock.companies.length,11);assert(blackrock.companies.every(item=>item.stakePercent===null));assert(blackrock.companies.some(item=>item.id==='ather-energy'));assert.equal(blackrock.events[0].date,'2026-08-31');
 Module._load=originalLoad;
 assert(html.includes('Foreign investor portfolios'));assert(html.includes('holdings table'));assert(html.includes('foreign-sidebar'));assert(!html.includes('foreign-investor-overview'));assert(!html.includes('foreign-company-grid')); // Sidebar navigation with table coverage by default.
 assert(html.indexOf('Aadhar Housing Finance')<html.indexOf('The Federal Bank'));
 const invalid=structuredClone(data);invalid.events[0].sourceIds=['missing'];assert.throws(()=>logic.validateForeignResearch(invalid));
 console.log('Foreign investors verified: eight registered investors; 23 new company/platform records; source integrity; filters and aggregation; ownership safeguards; authenticated APIs; D1 persistence and newer-record protection; page rendering.');
})().catch(e=>{console.error(e);process.exitCode=1;});
