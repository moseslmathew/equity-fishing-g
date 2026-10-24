const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),path=require('node:path');
const resolve=Module._resolveFilename;Module._resolveFilename=function(id,...args){return resolve.call(this,id.startsWith('@/')?path.join(process.cwd(),id.slice(2)):id,...args);};
require.extensions['.css']=()=>{};
require.extensions['.tsx']=(m,f)=>m._compile(ts.transpile(fs.readFileSync(f,'utf8'),{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}),f);
require('./database-test-runtime.cjs').setup({get:async()=>null,list:async()=>({objects:[],truncated:false})});
const {ventureResearch:data,ventureCompanyMatches:matches,ventureStatus:status}=require('../lib/venture-capital.ts');
assert.deepEqual(data.firms.map(f=>f.id),['peak-xv','accel','lightspeed','khosla']);
const company=(firm,id)=>data.firms.find(f=>f.id===firm).companies.find(c=>c.id===id);
for(const firm of data.firms){
 assert.equal(new Set(firm.companies.map(c=>c.id)).size,firm.companies.length);
 for(const c of firm.companies){
  assert(c.entry&&c.preIpoSource.url.startsWith('https://'));assert(c.note);
  assert.equal(c.market,'India');
  for(const h of c.holdings){assert(h.entity&&h.basis&&h.note&&h.source.url.startsWith('https://'));assert(h.asOf<=data.reviewedAt);assert(h.shares===null||Number.isSafeInteger(h.shares)&&h.shares>=0);assert(h.percent===null||h.percent>=0&&h.percent<=100);}
 }
}
assert.equal(data.firms.reduce((n,f)=>n+f.companies.length,0),17);
assert.equal(data.firms.find(f=>f.id==='khosla').companies.length,0);
assert.equal(matches(company('accel','blackbuck'),'Zinka'),true);
assert.equal(matches(company('accel','urban-company'),'ACCEL MAURITIUS'),true);
assert.equal(matches(company('peak-xv','eternal'),'Zomato'),true);
assert.equal(matches(company('peak-xv','eternal'),'not-a-real-name'),false);
assert.equal(company('peak-xv','meesho').holdings.length,2,'Keep distinct legal entities');
assert.equal(status(company('peak-xv','groww')),'historical');assert.equal(status(company('peak-xv','awfis')),'historical');assert.equal(status(company('peak-xv','eternal')),'unknown','Omitted shareholder is not a zero');
assert.equal(status(company('lightspeed','physicswallah')),'exited');assert.equal(company('lightspeed','physicswallah').holdings[0].evidence,'Reported exit','Do not represent a media exit report as a directly checked filing');
assert.equal(company('peak-xv','ixigo').holdings[0].evidence,'Filing');assert.equal(company('peak-xv','ixigo').holdings[0].percent,5.94,'Do not substitute fully diluted percentage');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),View=require('../app/venture-capital.tsx').default;
for(const firm of data.firms){const html=renderToStaticMarkup(React.createElement(View,{research:{...data,firms:[firm]}}));assert(html.includes(firm.shortName));assert(html.includes(firm.companies.length?'venture holdings table':'No verified Indian-listed investment identified.'));assert(!html.includes('>Export<'));assert(!html.includes('Sort venture companies'));assert(!html.includes('Venture investment display'));assert(html.includes('Ownership status'));assert(html.includes('vc-search'));assert(!html.includes('<details class="vc-details" open'));}
(async()=>{
 const auth=require('../lib/access.ts');let requestHeaders=new Headers();const load=Module._load;
 Module._load=function(id,...args){return id==='next/headers'?{headers:async()=>requestHeaders}:load.call(this,id,...args);};
 const Page=require('../app/venture-capital/page.tsx').default;
 const anonymous=await Page();assert(!anonymous.props.research,'Anonymous users receive login, not the research payload');
 requestHeaders=new Headers({cookie:auth.sessionCookie+'='+await auth.createSession()});const signedIn=await Page();assert.equal(signedIn.props.research.firms.length,4);
 const expired=await auth.createSession(Date.now()-8*86400000);requestHeaders=new Headers({cookie:auth.sessionCookie+'='+expired});assert(!(await Page()).props.research,'Expired session receives login');
 console.log('Venture capital checks passed: sources and dates, entity separation, unknown versus zero, Indian-only scope and empty-firm coverage, search aliases, all four rendered firms and authenticated page access.');
})().catch(error=>{console.error(error);process.exitCode=1;});
