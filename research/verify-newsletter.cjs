const assert=require('node:assert/strict');
const runtime=require('./database-test-runtime.cjs').setup({get:async()=>null,list:async()=>({objects:[],truncated:false})});
(async()=>{
 const {GET}=require('../app/api/research/route.ts');
 const res=await GET(new Request('https://test/api/research',{headers:{'x-fund-update-key':runtime.env.UPDATE_KEY}}));
 assert.equal(res.status,200);const report=await res.json();
 assert.equal(report.id,'research-2026-10-23-newsletter');assert.equal(report.portfolioChanged,false);
 const sept=report.periods.find(p=>p.month==='2026-09');assert.equal(sept.coverage,33);assert.equal(sept.companies,765);assert.equal(sept.mixed,123);
 for(const story of report.newsletter.stories){assert(story.paragraphs.length>=2);for(const ref of story.refs)assert(report.marketSources[ref]?.url.startsWith('https://'));}
 assert.equal(report.newsletter.stories.length,5);assert.equal(report.newsletter.watchlist.length,4);assert.equal(report.stocks.length,10);
 assert(report.newsletter.stories.some(s=>s.paragraphs.join(' ').includes('18,64,665')));
 const second=await GET(new Request('https://test/api/research',{headers:{'x-fund-update-key':runtime.env.UPDATE_KEY}}));assert.equal((await second.json()).id,report.id);
 assert.equal(runtime.sqlite.prepare('SELECT count(*) n FROM research_reports WHERE id=?').get(report.id).n,1);
 console.log('Newsletter passed: authenticated API, persisted edition, fingerprint, coverage, citations and company dossiers.');
})().catch(e=>{console.error(e);process.exitCode=1;});
