import snapshot from "../data/agent-research.json";
import {combinedAnalysis,type CombinedCompany} from "./combined-analysis";
import {comparisonCounts,type FullComparison} from "./full-portfolio";
import {bundledComparisons} from "./full-portfolio-store";
import {companyKey} from "./top-holdings";
import {schemeNames,fundCatalog} from "./fund-catalog";
import {monthlyLetter} from "./monthly-letter";

export function portfolioFingerprint(comparisons:FullComparison[]){
  // Change detection, not a security hash. Include quantities, notes and provenance.
  const value=JSON.stringify(comparisons.slice().sort((a,b)=>(a.currentDate+a.fundId).localeCompare(b.currentDate+b.fundId)));
  let hash=2166136261;for(let i=0;i<value.length;i++)hash=Math.imul(hash^value.charCodeAt(i),16777619);
  return (hash>>>0).toString(16);
}
export function researchReport(input:FullComparison[]=bundledComparisons,report:typeof snapshot=snapshot){
  const latest=new Map<string,FullComparison>();
  for(const c of input){const key=c.fundId+":"+c.currentDate;const old=latest.get(key);if(!old||Date.parse(c.checkedAt)>Date.parse(old.checkedAt))latest.set(key,c);}
  const comparisons=[...latest.values()].sort((a,b)=>(a.currentDate+a.fundId).localeCompare(b.currentDate+b.fundId));
  const months=[...new Set(comparisons.map(c=>c.currentDate.slice(0,7)))].sort();
  const analyses=months.map(month=>({month,...combinedAnalysis(comparisons,month,comparisons)}));
  const grouped=new Map<string,{name:string;periods:{month:string;coverage:number;company:CombinedCompany}[]}>();
  for(const period of analyses)for(const company of period.companies){const group=grouped.get(company.key)??{name:company.name,periods:[]};group.periods.push({month:period.month,coverage:period.coverage,company});grouped.set(company.key,group);}
  const evidence=(group:NonNullable<ReturnType<typeof grouped.get>>)=>{
    const addingFunds=new Set<string>(),reducingFunds=new Set<string>(),repeatFunds=new Set<string>();
    for(const p of group.periods)for(const f of p.company.funds){if(f.status==="new"||f.status==="increased")addingFunds.add(f.fundId);if(f.status==="decreased"||f.status==="exited")reducingFunds.add(f.fundId);}
    for(let i=1;i<group.periods.length;i++){
      const a=group.periods[i-1],b=group.periods[i];
      if(analyses.find(p=>p.month===b.month)?.previousMonth!==a.month)continue;
      for(const f of b.company.funds)if((f.status==="new"||f.status==="increased")&&a.company.funds.some(prior=>prior.fundId===f.fundId&&(prior.status==="new"||prior.status==="increased")))repeatFunds.add(f.fundId);
    }
    return {adding:addingFunds.size,reducing:reducingFunds.size,repeatFunds:[...repeatFunds].map(id=>schemeNames[id]),positivePeriods:group.periods.filter(p=>p.company.adding>0).length,periods:analyses.map(p=>({month:p.month,previousMonth:p.previousMonth,coverage:p.coverage,company:group.periods.find(g=>g.month===p.month)?.company??null}))};
  };
  const screen=[...grouped.entries()].map(([key,g])=>{const e=evidence(g);return {key,name:g.name,adding:e.adding,reducing:e.reducing,repeatFunds:e.repeatFunds,positivePeriods:e.positivePeriods,review:g.periods.reduce((n,p)=>n+p.company.review,0),periods:e.periods.map(p=>({month:p.month,coverage:p.coverage,adding:p.company?.adding??0,reducing:p.company?.reducing??0,review:p.company?.review??0,held:p.company?.funds.filter(f=>f.currentQuantity>0).length??0,observed:!!p.company,addingNames:p.company?.funds.filter(f=>f.status==="new"||f.status==="increased").map(f=>f.name)??[],reducingNames:p.company?.funds.filter(f=>f.status==="decreased"||f.status==="exited").map(f=>f.name)??[]}))};}).sort((a,b)=>b.repeatFunds.length-a.repeatFunds.length||b.positivePeriods-a.positivePeriods||b.adding-a.adding||a.reducing-b.reducing||a.name.localeCompare(b.name));
  const snapshots=new Set<string>();for(const c of comparisons){snapshots.add(c.fundId+":"+c.currentDate);snapshots.add(c.fundId+":"+c.previousDate);}
  const allFunds=new Set(comparisons.map(c=>c.fundId));
  const newest=analyses.at(-1);
  const letter=newest?monthlyLetter(report,newest,comparisons.filter(c=>c.currentDate.startsWith(newest.month)),analyses,comparisons):null;
  return {...report,...letter,portfolioChanged:!letter&&portfolioFingerprint(comparisons)!==report.portfolioFingerprint,coverage:allFunds.size,universe:grouped.size,snapshotCount:snapshots.size,comparisonCount:comparisons.length,screen,
    coverageByMonth:[...new Set(comparisons.flatMap(c=>[c.previousDate.slice(0,7),c.currentDate.slice(0,7)]))].sort().map(month=>({month,funds:new Set(comparisons.filter(c=>c.currentDate.slice(0,7)===month||c.previousDate.slice(0,7)===month).map(c=>c.fundId)).size})),
    periods:analyses.map(p=>({month:p.month,previousMonth:p.previousMonth,coverage:p.coverage,missingFunds:p.missingFunds,companies:p.companies.length,adding:p.companies.filter(c=>c.adding>0).length,reducing:p.companies.filter(c=>c.reducing>0).length,mixed:p.companies.filter(c=>c.mixed).length,review:p.reviewPositions})),
    fundActivity:fundCatalog.map(f=>({id:f.id,name:f.name,periods:months.map(month=>{const c=comparisons.find(c=>c.fundId===f.id&&c.currentDate.slice(0,7)===month);return c?{month,counts:comparisonCounts(c),checkedAt:c.checkedAt,basis:c.basis,sources:c.sources}:null;})})),
    stocks:report.stocks.map(stock=>{
      const matches=[...grouped.values()].filter(g=>g.periods.some(p=>companyKey(p.company.name)===companyKey(stock.name)));
      return {...stock,fundEvidence:matches.length===1?evidence(matches[0]):null};
    })};
}
export type ResearchReport=ReturnType<typeof researchReport>;
