const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve('.'),dir=path.resolve('../october-disclosures'),now=new Date().toISOString();
const seed=require('../data/seed.json'),september=require('../data/september-portfolios.json'),expansion=require('../data/fund-expansion-2026-10.json');
const base=[...seed.funds,...expansion.funds.filter(f=>f.portfolioDate==='2026-09-30')];
const previousAll=[...require('../data/full-portfolio-seed.json'),...september.comparisons,...expansion.comparisons].filter(c=>c.currentDate==='2026-09-30');
const records=JSON.parse(fs.readFileSync(path.join(dir,'collection.json')));
const official=['official-core.json','official-other.json','official-pending.json'].flatMap(file=>fs.existsSync(path.join(dir,file))?JSON.parse(fs.readFileSync(path.join(dir,file))):[]).map(o=>o.currentDate?o:{fundId:o.id,currentDate:o.disclosureDate,sourceUrl:o.sources[0].url,rows:o.holdings.filter(h=>h.instrument==='equity').map(h=>({key:h.companyId,name:h.company,quantity:h.quantity,weight:h.allocation})),audit:{file:o.file,sha256:o.sha256,complete:o.complete,aum:o.aum}});
const norm=s=>s.toLowerCase().replace(/\b(limited|ltd)\b/g,'').replace(/[^a-z0-9]/g,'');
const equity=h=>/^INE[A-Z0-9]{9}$/.test(h.isin||h.key)&&!/future|option|\bETF\b|\bREIT\b|\bInvIT\b|debenture/i.test(h.name);
const funds=[],comparisons=[],audit=[],pending=[];
for(const f of base){
 const r=records.find(r=>r.id===f.id),o=official.find(o=>o.fundId===f.id&&o.currentDate==='2026-10-31'),p=r?.october;
 if(!o&&!p?.holdings.length){pending.push({fundId:f.id,name:f.name,reason:'No verified October month-end equity disclosure retrieved. September records retained.',sources:[r?.url,r?.trackerUrl,...f.sources.map(s=>s.url)].filter(Boolean)});continue;}
 if(p){assert.equal(p.period,'2026-10-31');assert.equal(p.prevPeriod,'2026-09-30');}
 const raw=o?o.rows.map(h=>({...h,isin:h.key})):p.holdings.filter(equity).filter(h=>h.quantity>0).map(h=>({key:h.isin,isin:h.isin,name:h.name,quantity:h.quantity,weight:Number((h.pctNav*100).toFixed(8))}));
 const current=new Map(raw.filter(h=>h.quantity>0).map(h=>[h.key,h]));assert.equal(current.size,raw.length);assert(current.size>=30);
 for(const h of current.values()){assert(Number.isSafeInteger(h.quantity)&&h.quantity>0);assert(Number.isFinite(h.weight)&&h.weight>=0&&h.weight<=100);}
 assert([...current.values()].reduce((s,h)=>s+h.weight,0)<=100.1);
 const priorComparison=previousAll.find(c=>c.fundId===f.id),priorOfficial=official.find(c=>c.fundId===f.id&&c.currentDate==='2026-09-30');
 const previous=new Map(priorOfficial?priorOfficial.rows.filter(h=>h.quantity>0).map(h=>[h.key,{...h,currentQuantity:h.quantity,weight:h.weight}]):priorComparison?.rows.filter(h=>h.currentQuantity>0).map(h=>[h.key,h])??[]);
 const providerMap=new Map(p?.holdings.filter(equity).map(h=>[h.isin,h])??[]);
 const trackerHtml=fs.existsSync(path.join(dir,f.id+'-tracker.html'))?fs.readFileSync(path.join(dir,f.id+'-tracker.html'),'utf8'):'';
 const trackerOctober=/portfolio holdings, Oct 2026:/.test(trackerHtml);
 const crosschecks=[],conflicts=[];
 for(const h of current.values()){
  const second=trackerOctober?r?.trackerRows?.filter(t=>norm(t.name)===norm(h.name)):[];
  if(second?.length===1){if(second[0].quantity===h.quantity&&Math.abs(second[0].weight-h.weight)<=0.011)crosschecks.push(h.key);else conflicts.push(h.key);}
 }
 const top=[...current.values()].sort((a,b)=>b.weight-a.weight||a.name.localeCompare(b.name)).slice(0,30);
 const matched=top.every(h=>crosschecks.includes(h.key));
 const primarySource=o?{label:'Official October 2026 portfolio',url:o.sourceUrl,type:'official',portfolioDate:'2026-10-31',matched:true}: {label:'DecryptMutualFunds · October 2026',url:r.url,type:'third_party',portfolioDate:'2026-10-31',matched:true};
 const second=trackerOctober&&r?.trackerRows?.length?{label:'Fund Tracker India · October 2026',url:r.trackerUrl,type:'third_party',portfolioDate:'2026-10-31',matched}:{...f.sources[0],label:'Historical source · '+f.portfolioDate,matched:false};
 const sources=[primarySource,second];
 const comparisonSources=[{label:primarySource.label,url:primarySource.url,scope:o?'Original AMC October workbook; complete equity quantities and % of net assets.':'October provider quantities and allocations; original AMC workbook not retrieved.'},...(priorOfficial?[{label:'Official September 2026 portfolio',url:priorOfficial.sourceUrl,scope:'Original AMC September workbook; complete equity quantities and allocations.'}]:priorComparison?.sources??f.sources.map(s=>({label:s.label,url:s.url,scope:'Historical September allocation evidence; not October corroboration.'}))),...(trackerOctober&&r?.trackerRows?.length?[{label:second.label,url:second.url,scope:`October cross-check: ${crosschecks.length} exact company quantities and allocations matched; ${conflicts.length} disagreements. This page may cover only a subset of equities.`}]:[])];
 const notes=[o?'Original October AMC workbook: exact scheme, date, equity section, absolute quantities and net-asset allocation units validated.':'October provider disclosure. Original AMC workbook validation is pending; this is not official confirmation.',`${crosschecks.length} company quantities and allocations corroborated against a second October source; ${conflicts.length} disagree. Top-30 coverage ${matched?'fully matched':'not fully independently matched'}.`,'Changes are net month-end quantities; transaction timing and manager intent are unknown. Unresolved source or identifier differences are withheld from movement classifications.'];
 const rowKeys=new Set([...current.keys(),...previous.keys(),...providerMap.keys()]);
 const rows=[];
 for(const key of rowKeys){const h=current.get(key),old=previous.get(key),provider=providerMap.get(key);if(!h&&!old&&!provider?.qtyPrev)continue;
  let prev=old?.currentQuantity??provider?.qtyPrev??(previous.size?0:null),note=null;
  if(prev===null)note='A complete September equity quantity snapshot is unavailable; direction withheld.';
  if(provider&&old&&provider.qtyPrev!==undefined&&provider.qtyPrev!==old.currentQuantity)note='Prior quantity differs between the saved September disclosure and the October provider; direction withheld pending reconciliation.';
  if(conflicts.includes(key))note='October quantities or allocation disagree across sources; original AMC values are retained where available, direction withheld.';
  if(!o&&h&&!crosschecks.includes(key))note=note??'October quantity has not been independently corroborated; direction withheld.';
  if(!h&&!o&&provider?.quantity!==0)note=note??'Security absent from the complete October provider list; exit withheld pending identifier / corporate-action reconciliation.';
  if(h&&old&&old.currentQuantity>0){const ratio=h.quantity/old.currentQuantity;if(ratio>=1.9||ratio<=0.51)note=note??'Large quantity change: corporate-action / capital-change review required before attributing activity.';}
  if(!h&&prev===0)continue;
  rows.push({key,name:(h??old??provider).name,previousQuantity:prev,currentQuantity:h?.quantity??0,weight:h?.weight??0,previousWeight:old?.weight??(provider?.pctNavPrev!==undefined?Number((provider.pctNavPrev*100).toFixed(8)):null),note});
 }
 const c={fundId:f.id,currentDate:'2026-10-31',previousDate:'2026-09-30',checkedAt:now,scope:'full_equity',basis:o?'official_disclosures':'provider_quantity_comparison',rows,sources:[...new Map(comparisonSources.map(s=>[s.url,s])).values()],notes};
 const fund={...f,portfolioDate:'2026-10-31',lastCheckedAt:now,verification:o?(matched?'official_match':'official_only'):(matched?'provider_match':'provider_only'),checkStatus:'checked',holdings:top.map(h=>({key:h.key,name:h.name,weight:h.weight})),sources,notes};delete fund.holdingsEvidence;
 funds.push(fund);comparisons.push(c);audit.push({fundId:f.id,originalWorkbook:!!o,rows:current.size,equityWeightSum:Number([...current.values()].reduce((s,h)=>s+h.weight,0).toFixed(4)),crosschecked:crosschecks.length,conflicts,reviewPositions:rows.filter(r=>r.note).length,officialAudit:o?.audit??null});
}
const historicalFunds=official.filter(o=>o.fundId==='quantum'&&o.currentDate==='2026-09-30').map(o=>({...base.find(f=>f.id===o.fundId),portfolioDate:o.currentDate,lastCheckedAt:now,verification:'official_only',checkStatus:'checked',holdings:o.rows.slice().sort((a,b)=>b.weight-a.weight).slice(0,30).map(h=>({key:h.key,name:h.name,weight:h.weight})),sources:[{label:'Official September 2026 portfolio',url:o.sourceUrl,type:'official',portfolioDate:o.currentDate,matched:true},{label:'Official October 2026 portfolio',url:official.find(x=>x.fundId===o.fundId&&x.currentDate==='2026-10-31').sourceUrl,type:'official',portfolioDate:'2026-10-31',matched:false}],holdingsEvidence:undefined,notes:['Previously missing September record backfilled from the original AMC disclosure to support the adjacent October comparison.']}));
const result={month:'2026-10',checkedAt:now,funds,comparisons,pending,historicalFunds};
fs.writeFileSync(path.join(root,'data/october-portfolios.json'),JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(path.join(root,'research/october-import-audit.json'),JSON.stringify({checkedAt:now,funds:audit,pending},null,2)+'\n');
console.log('October funds',funds.length,'comparisons',comparisons.length,'official',audit.filter(a=>a.originalWorkbook).length,'pending',pending.map(f=>f.fundId));
