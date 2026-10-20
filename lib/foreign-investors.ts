export type ForeignSource={title:string;url:string;publisher:string;published:string;kind:"primary"|"reporting";note?:string};
export type ForeignStance="added"|"reduced"|"held"|"exited"|"proposed";
export type ForeignCompany={id:string;name:string;ticker?:string;listing:string;sector:string;relationship:string;ownership:string;ownershipDate:string;stakePercent:number|null;stance:ForeignStance;summary:string;thesis:string;risks:string;sourceIds:string[]};
export type ForeignEvent={id:string;companyId:string;date:string;dateLabel:string;title:string;kind:"equity"|"transfer"|"platform"|"capex"|"snapshot"|"interest";direction:ForeignStance;status:"Completed"|"Approved"|"Announced"|"Reported"|"Snapshot"|"Timing uncertain";detail:string;qualification:string;sourceIds:string[]};
export type ForeignResearch={id:string;name:string;asOf:string;checkedAt:string;windowStart:string;windowEnd:string;coverage:string;limitations:string[];sources:Record<string,ForeignSource>;companies:ForeignCompany[];events:ForeignEvent[];report:{title:string;summary:string;sections:{title:string;text:string;sourceIds:string[]}[];themes:{name:string;conviction:string;case:string;watch:string;sourceIds:string[]}[]}};
export const stanceLabels:Record<ForeignStance,string>={added:"New / added exposure",reduced:"Reduced exposure",held:"Existing holding",exited:"Exited",proposed:"Reported / proposed"};
export type ForeignFilters={query:string;listing:string;stance:string;period:string;sort:string};
export function selectForeignCompanies(data:ForeignResearch,f:ForeignFilters){
 const words=f.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
 const active=new Set(data.events.filter(e=>e.date>=data.windowStart&&e.date<=data.windowEnd&&e.kind!=="snapshot").map(e=>e.companyId));
 return data.companies.filter(c=>words.every(w=>[c.name,c.ticker,c.sector,c.relationship].join(" ").toLocaleLowerCase().includes(w))&&(f.listing==="all"||f.listing==="listed"&&c.listing.startsWith("Listed")||f.listing==="private"&&!c.listing.startsWith("Listed"))&&(f.stance==="all"||f.stance===c.stance)&&(f.period!=="year"||active.has(c.id))).sort((a,b)=>{
  if(f.sort==="stake"){if(a.stakePercent===null&&b.stakePercent!==null)return 1;if(b.stakePercent===null&&a.stakePercent!==null)return -1;const d=(b.stakePercent??0)-(a.stakePercent??0);if(d)return d;}
  return a.name.localeCompare(b.name,"en");
 });
}
export function validateForeignResearch(d:ForeignResearch){
 if(!d.id||!d.name||!d.windowStart||!d.windowEnd||!Number.isFinite(Date.parse(d.checkedAt))||!d.companies.length)throw new Error("Invalid foreign investor research snapshot.");
 const ids=new Set<string>();for(const c of d.companies){if(ids.has(c.id)||!c.name||!stanceLabels[c.stance]||c.stakePercent!==null&&(c.stakePercent<0||c.stakePercent>100))throw new Error("Invalid company.");ids.add(c.id);}
 const eventIds=new Set<string>();for(const e of d.events){if(eventIds.has(e.id)||!ids.has(e.companyId)||e.date<d.windowStart||e.date>d.windowEnd||!e.qualification)throw new Error("Invalid activity.");eventIds.add(e.id);}
 for(const x of [...d.companies,...d.events,...d.report.sections,...d.report.themes]){if(!x.sourceIds.length||x.sourceIds.some(id=>!d.sources[id]))throw new Error("Missing evidence.");}
 for(const s of Object.values(d.sources)){if(new URL(s.url).protocol!=="https:")throw new Error("Invalid source URL.");}
 return d;
}
