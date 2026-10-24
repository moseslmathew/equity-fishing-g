import {allCompanyHoldings} from "./fund-search";
import {companyIdentity} from "./company-identity";
import {companyKey} from "./top-holdings";
import {nseSymbol,nseSecurity} from "./nse-security-links";
import {ventureStatus,type VentureResearch} from "./venture-capital";
import type {AceCombinedResult} from "./ace-combined-analysis";
import type {ForeignResearch} from "./foreign-investors";
export type SearchEntry={id:string;owner:string;value:number|null;measure:"allocation"|"equity"|"research";date:string;status:string;source?:string;note?:string};
export type SearchGroup={id:string;label:string;href:string;entries:SearchEntry[]};
export type CompanySearchResult={id:string;name:string;symbol:string|null;aliases:string[];groups:SearchGroup[]};
export type SearchInput={portfolio?:Parameters<typeof allCompanyHoldings>[0];ace?:AceCombinedResult;foreign?:ForeignResearch[];venture?:VentureResearch;research?:{asOf:string;stocks:{name:string;symbol:string;verdict:string;sources?:{checkedOn:string}[]}[]}};
export const searchSections={funds:{label:"Mutual funds",href:"/"},ace:{label:"Ace investors",href:"/#investors"},foreign:{label:"Foreign investors",href:"/foreign-investors"},venture:{label:"Venture capital",href:"/venture-capital"},research:{label:"AI Insights",href:"/"}};
export function searchCompanies(input:SearchInput,query:string,limit=12){
 const companies=new Map<string,CompanySearchResult>();
 const fundRows=input.portfolio?allCompanyHoldings(input.portfolio):[];
 const identity=companyIdentity(fundRows.map(r=>({name:r.name,key:r.isin})));
 function add(name:string,section:keyof typeof searchSections,entry:SearchEntry,ticker?:string|null,isin?:string,aliases:string[]=[]){
  const known=ticker?nseSecurity(ticker.replace(/^NSE:\s*/i,"")):null;
  const identified=identity({name,key:isin});
  const symbol=known?.symbol??nseSymbol(identified.name,isin);
  const security=symbol?nseSecurity(symbol):null;
  const key=security?"nse:"+symbol:identified.id;
  const company=companies.get(key)??{id:key,name:security?.name??identified.name,symbol,aliases:[],groups:[]};
  company.aliases=[...new Set([...company.aliases,name,...identified.aliases,...aliases,...(symbol?[symbol]:[])])];
  let group=company.groups.find(g=>g.id===section);
  if(!group){group={id:section,...searchSections[section],entries:[]};company.groups.push(group);}
  if(!group.entries.some(e=>e.id===entry.id))group.entries.push(entry);
  companies.set(key,company);
 }
 for(const r of fundRows){const f=input.portfolio!.funds.find(f=>f.id===r.fundId)!;add(r.name,"funds",{id:r.fundId,owner:r.fundName,value:r.weight,measure:"allocation",date:f.portfolioDate,status:"Saved holding",source:f.sources?.[0]?.url},null,r.isin,r.aliases);}
 for(const comparison of input.portfolio?.fullComparisons??[])for(const h of comparison.rows){
  if(h.currentQuantity!==0||h.previousQuantity===null||h.previousQuantity<=0)continue;
  const fund=input.portfolio!.funds.find(f=>f.id===comparison.fundId);if(!fund)continue;
  add(h.name,"funds",{id:comparison.fundId,owner:fund.name,value:0,measure:"allocation",date:comparison.currentDate,status:"Exited position",source:comparison.sources[0]?.url},null,h.key);
 }
 for(const c of input.ace?.companies??[])for(const o of c.owners)add(c.name,"ace",{id:o.investorId,owner:o.investorName,value:o.stake,measure:"equity",date:o.date,status:o.status==="review"?"Needs review":"Disclosed stake",source:o.sources[0]?.url,note:o.holder});
 for(const d of input.foreign??[])for(const c of d.companies)add(c.name,"foreign",{id:d.id+":"+c.id,owner:d.name,value:c.stakePercent,measure:"equity",date:c.ownershipDate,status:d.sources[c.sourceIds[0]]?.kind==="reporting"?(c.stakePercent===null?"Reported record":"Reported stake"):c.stance,source:d.sources[c.sourceIds[0]]?.url,note:c.ownership},c.ticker);
 for(const f of input.venture?.firms??[])for(const c of f.companies){const status=ventureStatus(c);if(!c.holdings.length)add(c.name,"venture",{id:f.id+":"+c.id,owner:f.shortName,value:null,measure:"equity",date:input.venture!.reviewedAt,status:"Pre-IPO backing; stake unconfirmed",source:c.preIpoSource.url},c.ticker);else for(const [i,h]of c.holdings.entries())add(c.name,"venture",{id:f.id+":"+c.id+":"+i,owner:f.shortName,value:h.percent,measure:"equity",date:h.asOf,status:status==="exited"?"Reported exit":status==="historical"?"Historical snapshot":h.evidence,source:h.source.url,note:h.entity},c.ticker);}
 for(const s of input.research?.stocks??[])add(s.name,"research",{id:s.symbol,owner:"Company dossier",value:null,measure:"research",date:s.sources?.map(source=>source.checkedOn).filter(Boolean).sort().at(-1)??input.research!.asOf,status:"Dated research",note:s.verdict},s.symbol);
 const compact=companyKey(query);
 const tokens=(value:string)=>value.normalize("NFKD").replace(/\p{M}/gu,"").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
 const terms=tokens(query);
 const matches=[...companies.values()].filter(c=>c.aliases.some(alias=>companyKey(alias).startsWith(compact))||terms.every(term=>c.aliases.some(alias=>tokens(alias).some(word=>word.startsWith(term)))));
 matches.sort((a,b)=>{
  const score=(c:CompanySearchResult)=>c.aliases.some(n=>companyKey(n)===compact)?0:c.aliases.some(n=>companyKey(n).startsWith(compact))?1:2;
  return score(a)-score(b)||a.name.localeCompare(b.name);
 });
 for(const c of matches)for(const g of c.groups)g.entries.sort((a,b)=>a.owner.localeCompare(b.owner)||b.date.localeCompare(a.date));
 return {total:matches.length,companies:matches.slice(0,limit)};
}
