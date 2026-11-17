import {investorOutlook} from "./investor-outlook";
import snapshot from "../data/agent-research.json";
import {combinedAnalysis,type CombinedCompany} from "./combined-analysis";
import {comparisonCounts,type FullComparison} from "./full-portfolio";
import {bundledComparisons} from "./full-portfolio-store";
import {companyKey} from "./top-holdings";
import {schemeNames,fundCatalog} from "./fund-catalog";
import {threeMonthResearch} from "./three-month-research";
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
  const deep=newest?threeMonthResearch(comparisons,newest.month):null;
  const deepSources=deep?.sources.map(s=>({label:s.label,url:s.url,kind:"Portfolio disclosure",period:deep.months.join(" → "),checkedOn:comparisons.filter(c=>c.sources.some(source=>source.url===s.url)).map(c=>c.checkedAt.slice(0,10)).sort().at(-1)!}))??[];
  const newsletter=deep?.available?{edition:deep.months.join(" → ")+" · THREE-MONTH REVIEW",editorNote:`This review follows the same ${deep.funds.length} funds through ${deep.months.join(" → ")}. Three month-end snapshots provide two consecutive change intervals. ${deep.positions} fund–company positions pass identity, continuity and source-note checks; ${deep.excluded.length} are excluded.

The strongest useful discoveries are persistence, reversals and disagreements between share quantities and allocation weights. Each finding below is calculated from saved disclosures. It is evidence for further investigation, not proof of manager intent or undervaluation.`,stories:deep.stories,watchlist:[{title:"Confirm the next disclosure",text:"Check whether repeat additions persist, reversals continue, and recent initiations survive. Compare the same schemes again."},{title:"Resolve excluded positions",text:`${deep.excluded.length} positions need reconciliation. Missing prior values, duplicate identities and inconsistent middle-month values do not contribute to directional findings.`},{title:"Investigate the business",text:"For the persistent names, verify the next issuer results, cash conversion, debt and valuation before drawing an investment conclusion. This report measures portfolios, not business quality."}],closing:"Month-end quantities can also change through corporate actions. Flagged observations are excluded, but unflagged splits, mergers or reclassifications still need original-filing review."}:letter?.newsletter??report.newsletter;

  return {...report,...letter,deepResearch:deep,investorOutlook:investorOutlook(deep),newsletter,newsletterSources:deep?.available?deepSources:report.marketSources,title:deep?.available?`${new Intl.DateTimeFormat('en-IN',{month:'long',year:'numeric'}).format(new Date(newest!.month+'-01'))}: beneath the portfolio changes`:letter?.title??report.title,summary:deep?.available?`A three-month investigation across ${deep.funds.length} matched funds and ${deep.companies} companies, tracing persistent accumulation, reversals, position survival and hidden allocation divergences.`:letter?.summary??report.summary,coverageNote:deep?.available?`${deep.positions} reconciled fund–company positions; ${deep.primaryPositions} supported by original AMC comparisons in both intervals. Remaining positions use provider evidence for at least one interval. ${deep.excluded.length} positions excluded.`:letter?.coverageNote??report.coverageNote,method:"Compare adjacent complete equity portfolios using a constant fund sample and exact company identity. Require month-end observations and exact agreement in middle-month quantities; reject middle-month allocation differences over 0.02 percentage points, exclude flagged or duplicate rows and disclose the calculation denominator. Absence is zero only within a saved full-equity comparison. Three snapshots provide two change intervals; quantities are not cash flows.",modelDisclosure:"Findings and narrative are generated from reproducible calculations over the saved portfolio archive. The investor outlook adds a dated review of issuer filings, independent calculations and conditional scenarios. Corporate research does not refresh automatically; no live model call is implied.",modelName:"Portfolio evidence engine",horizon:"Three-month observation",limitations:"Coverage is limited to saved full-equity comparisons. Unflagged corporate actions may affect quantities. Fund schemes are not necessarily independent managers. Portfolio weights are percentages of fund net assets, not company ownership. Missing or inconsistent positions are excluded. No prices, cash traded, performance or manager intent are inferred.",portfolioChanged:!deep?.available&&!letter&&portfolioFingerprint(comparisons)!==report.portfolioFingerprint,coverage:allFunds.size,universe:grouped.size,snapshotCount:snapshots.size,comparisonCount:comparisons.length,screen,
    coverageByMonth:[...new Set(comparisons.flatMap(c=>[c.previousDate.slice(0,7),c.currentDate.slice(0,7)]))].sort().map(month=>({month,funds:new Set(comparisons.filter(c=>c.currentDate.slice(0,7)===month||c.previousDate.slice(0,7)===month).map(c=>c.fundId)).size})),
    periods:analyses.map(p=>({month:p.month,previousMonth:p.previousMonth,coverage:p.coverage,missingFunds:p.missingFunds,companies:p.companies.length,adding:p.companies.filter(c=>c.adding>0).length,reducing:p.companies.filter(c=>c.reducing>0).length,mixed:p.companies.filter(c=>c.mixed).length,review:p.reviewPositions})),
    fundActivity:fundCatalog.map(f=>({id:f.id,name:f.name,periods:months.map(month=>{const c=comparisons.find(c=>c.fundId===f.id&&c.currentDate.slice(0,7)===month);return c?{month,counts:comparisonCounts(c),checkedAt:c.checkedAt,basis:c.basis,sources:c.sources}:null;})})),
    stocks:report.stocks.map(stock=>{
      const matches=[...grouped.values()].filter(g=>g.periods.some(p=>companyKey(p.company.name)===companyKey(stock.name)));
      return {...stock,fundEvidence:matches.length===1?evidence(matches[0]):null};
    })};
}
export type ResearchReport=ReturnType<typeof researchReport>;
