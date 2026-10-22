import type {Fund} from "./portfolio";
import type {FullComparison} from "./full-portfolio";
import supplement from "../data/quantum-top30-supplement.json";
export const holdingLimit=30;
export function companyKey(name:string){
  const aliases:Record<string,string>={MCX:"Multi Commodity Exchange of India",BHEL:"Bharat Heavy Electricals"};
  return (aliases[name]??name).toLowerCase().replace(/\((?:formerly|previously)[^)]*\)/g,"").replace(/\b(limited|ltd)\b/g,"").replace(/[^a-z0-9]/g,"");
}
// Enrich only from the same dated complete equity disclosure. Never carry ranks
// across months or claim an incomplete set of weights is a complete ranking.
export function withTopHoldings(fund:Fund,comparison?:FullComparison):Fund {
  if(fund.holdings.length>=holdingLimit)return fund;
  if(fund.id===supplement.fundId&&fund.portfolioDate===supplement.portfolioDate&&fund.holdings.length===15&&Date.parse(fund.lastCheckedAt)<=Date.parse(supplement.checkedAt)){
    const existing=new Set(fund.holdings.map(h=>companyKey(h.name)));
    if(supplement.holdings.every(h=>!existing.has(companyKey(h.name))&&h.weight<=fund.holdings.at(-1)!.weight))return {...fund,holdings:[...fund.holdings,...supplement.holdings].sort((a,b)=>b.weight-a.weight),holdingsEvidence:{basis:"published_allocations",checkedAt:supplement.checkedAt,sources:supplement.sources},notes:[...fund.notes,"Ranks 16–30 allocations were cross-checked between GMP IPO Watch and MF Scanner for September 2026. This extends allocations only; no full share-quantity comparison is inferred."]};
  }
  if(!comparison||comparison.fundId!==fund.id||![comparison.currentDate,comparison.previousDate].includes(fund.portfolioDate))return fund;
  const prior=comparison.previousDate===fund.portfolioDate;
  const current=prior?comparison.rows.filter(row=>(row.previousQuantity??0)>0||(row.previousWeight??0)>0).map(row=>({...row,weight:row.previousWeight})):comparison.rows.filter(row=>row.currentQuantity>0);
  if(current.length<holdingLimit||current.some(row=>row.weight===null))return fund;
  const ranked=current.slice().sort((a,b)=>b.weight!-a.weight!).slice(0,holdingLimit);
  // Retain saved corroborated figures; refuse conflicting full-portfolio data.
  if(fund.holdings.some(old=>!ranked.slice(0,fund.holdings.length).some(row=>companyKey(row.name)===companyKey(old.name)&&row.weight===old.weight)))return fund;
  return {...fund,holdings:ranked.map(row=>{
    const old=fund.holdings.find(item=>companyKey(item.name)===companyKey(row.name));
    return old??{key:row.key,name:row.name.replace(/\*+$/g,""),weight:row.weight!};
  }),holdingsEvidence:{basis:"saved_full_portfolio",checkedAt:comparison.checkedAt,sources:comparison.sources},notes:[...fund.notes.filter(note=>!note.startsWith("The top 15 are ranked")),"The top 30 are ranked from the saved full equity disclosure for this same date."+(prior?" Uses the explicitly reported prior-month allocations in the adjacent comparison; no share quantities are inferred.":"")+" Previously saved allocations are retained; additional positions carry the full-portfolio source coverage shown below, not an independent verification of every allocation."]};
}
