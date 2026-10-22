import {movement,type FullComparison,type FullHolding,type Movement} from "./full-portfolio";
import {fundCatalog,schemeNames} from "./fund-catalog";
import {companyIdentity} from "./company-identity";

export type CombinedMovement="increased"|"decreased"|"new"|"exited"|"unchanged"|"mixed"|"review";
export type FundContribution={fundId:string;name:string;previousQuantity:number|null;currentQuantity:number;delta:number|null;weight:number|null;status:Movement;note:string|null;sources:FullComparison["sources"]};
export type CombinedCompany={key:string;name:string;previousQuantity:number|null;currentQuantity:number;delta:number|null;status:CombinedMovement;mixed:boolean;changed:boolean;adding:number;reducing:number;review:number;funds:FundContribution[]};
export function combinedAnalysis(comparisons:FullComparison[],month:string,identityComparisons:FullComparison[]=comparisons){
  const [y,m]=month.split("-").map(Number),previousMonth=new Date(Date.UTC(y,m-2,1)).toISOString().slice(0,7);
  const currentDate=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10),previousDate=new Date(Date.UTC(y,m-1,0)).toISOString().slice(0,10);
  const latest=new Map<string,FullComparison>();
  for(const c of comparisons){if(!schemeNames[c.fundId]||c.currentDate!==currentDate||c.previousDate!==previousDate||c.scope!=="full_equity")continue;const old=latest.get(c.fundId);if(!old||Date.parse(c.checkedAt)>Date.parse(old.checkedAt))latest.set(c.fundId,c);}
  // Exact normalized names bridge older name-based IDs. Matching ISINs bridge
  // spelling variants and renames across funds; no fuzzy company matching.
  const identity=companyIdentity(identityComparisons.flatMap(c=>c.rows));
  const grouped=new Map<string,{name:string;contributions:Map<string,{c:FullComparison;rows:FullHolding[]}>}>();
  for(const c of latest.values())for(const row of c.rows){const key=identity(row).id;let group=grouped.get(key);if(!group){group={name:row.name.replace(/\*+$/g,""),contributions:new Map()};grouped.set(key,group);}let entry=group.contributions.get(c.fundId);if(!entry){entry={c,rows:[]};group.contributions.set(c.fundId,entry);}entry.rows.push(row);}
  const companies:CombinedCompany[]=[];
  for(const [key,group] of grouped){
    const funds:FundContribution[]=[];
    for(const [fundId,{c,rows}] of group.contributions){
      const currentQuantity=rows.reduce((sum,row)=>sum+row.currentQuantity,0),previousQuantity=rows.some(row=>row.previousQuantity===null)?null:rows.reduce((sum,row)=>sum+row.previousQuantity!,0);
      const disputed=rows.length>1||rows.some(row=>movement(row)==="review"),status:Movement=disputed?"review":movement(rows[0]);
      funds.push({fundId,name:schemeNames[fundId],previousQuantity,currentQuantity,delta:disputed||previousQuantity===null?null:currentQuantity-previousQuantity,weight:rows.some(row=>row.weight===null)?null:rows.reduce((sum,row)=>sum+row.weight!,0),status,note:rows.length>1?"Multiple security rows map to this company in the same fund; combined classification is withheld.":rows[0].note,sources:c.sources});
    }
    funds.sort((a,b)=>a.name.localeCompare(b.name));
    const currentQuantity=funds.reduce((sum,f)=>sum+f.currentQuantity,0),previousQuantity=funds.some(f=>f.previousQuantity===null)?null:funds.reduce((sum,f)=>sum+f.previousQuantity!,0);
    const review=funds.filter(f=>f.status==="review").length,adding=funds.filter(f=>f.status==="increased"||f.status==="new").length,reducing=funds.filter(f=>f.status==="decreased"||f.status==="exited").length,mixed=adding>0&&reducing>0;
    const delta=review||previousQuantity===null?null:currentQuantity-previousQuantity;
    const status:CombinedMovement=delta===null?"review":previousQuantity===0?"new":currentQuantity===0?"exited":delta>0?"increased":delta<0?"decreased":mixed?"mixed":"unchanged";
    companies.push({key,name:group.name,previousQuantity,currentQuantity,delta,status,mixed,changed:funds.some(f=>f.status!=="unchanged"),adding,reducing,review,funds});
  }
  companies.sort((a,b)=>Math.abs(b.delta??0)-Math.abs(a.delta??0)||a.name.localeCompare(b.name));
  return {companies,coverage:latest.size,missingFunds:fundCatalog.filter(f=>!latest.has(f.id)).map(f=>f.name),previousMonth,reviewPositions:companies.reduce((sum,c)=>sum+c.review,0)};
}
