import type {MonthlyPortfolio} from "./monthly";
import {companyKey} from "./top-holdings";
import {matchesSearch} from "./search";
import {companyIdentity} from "./company-identity";
import {nseSymbol} from "./nse-security-links";

export function allCompanyHoldings(data:Pick<MonthlyPortfolio,"funds"|"fullComparisons"|"previousFunds"|"previousMonth">){
  const identity=companyIdentity([...data.fullComparisons.flatMap(c=>c.rows),...data.funds.flatMap(f=>f.holdings),...data.previousFunds.flatMap(f=>f.holdings)]);
  return data.funds.flatMap(fund=>{
    const comparison=data.fullComparisons.find(item=>item.fundId===fund.id&&item.currentDate===fund.portfolioDate);
    const before=data.previousFunds.find(item=>item.id===fund.id&&item.portfolioDate.slice(0,7)===data.previousMonth);
    const previousRows=new Map(comparison?.previousDate.slice(0,7)===data.previousMonth?comparison.rows.map(row=>[identity(row).id,row] as const):[]);
    const holdings=new Map<string,{name:string;isin?:string;weight:number|null}>();
    for(const row of comparison?.rows??[]){
      if(row.currentQuantity>0)holdings.set(identity(row).id,{name:row.name,isin:row.key,weight:row.weight});
    }
    for(const row of fund.holdings)holdings.set(identity(row).id,{name:row.name,isin:row.key,weight:row.weight});
    return [...holdings.entries()].map(([key,holding])=>{
      const priorHolding=before?.holdings.find(row=>identity(row).id===key);
      const priorRow=previousRows.get(key);
      const previousWeight=priorHolding?.weight??priorRow?.previousWeight??(priorRow?.previousQuantity===0?0:null);
      const change=holding.weight===null||previousWeight===null?null:Math.round((holding.weight-previousWeight)*100)/100;
      const company=identity({name:holding.name,key:holding.isin});
      const symbol=nseSymbol(holding.name,holding.isin);
      return {...holding,name:company.name,companyId:company.id,aliases:[...company.aliases,...(symbol?[symbol]:[])],key:fund.id+":"+companyKey(company.name),fundId:fund.id,fundName:fund.name,previousWeight,change};
    });
  }).sort((a,b)=>a.name.localeCompare(b.name,"en-IN")||a.fundName.localeCompare(b.fundName,"en-IN"));
}

export function searchCompanyHoldings(data:MonthlyPortfolio,query:string){
  return query.trim()?allCompanyHoldings(data).filter(holding=>matchesSearch(query,holding.aliases)):[];
}

export function sharedCompanyHoldings(data:MonthlyPortfolio){
  const grouped=new Map<string,{name:string;isin?:string;funds:{id:string;name:string;weight:number|null}[]}>();
  for(const holding of allCompanyHoldings(data)){
    const key=holding.companyId;
    const company=grouped.get(key)??{name:holding.name,isin:holding.isin,funds:[]};
    company.funds.push({id:holding.fundId,name:holding.fundName,weight:holding.weight});
    grouped.set(key,company);
  }
  const companies=[...grouped.values()].filter(company=>company.funds.length>1).sort((a,b)=>b.funds.length-a.funds.length||a.name.localeCompare(b.name,"en-IN"));
  const fullFunds=data.funds.filter(fund=>data.fullComparisons.some(item=>item.fundId===fund.id&&item.currentDate===fund.portfolioDate&&item.rows.length>0)).length;
  return {companies,fullFunds,topOnlyFunds:data.funds.length-fullFunds,totalFunds:data.funds.length};
}
