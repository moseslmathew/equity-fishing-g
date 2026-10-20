import type {MonthlyPortfolio} from "./monthly";
import {companyKey} from "./top-holdings";
import {matchesSearch} from "./search";

export function allCompanyHoldings(data:MonthlyPortfolio){
  return data.funds.flatMap(fund=>{
    const comparison=data.fullComparisons.find(item=>item.fundId===fund.id&&item.currentDate===fund.portfolioDate);
    const before=data.previousFunds.find(item=>item.id===fund.id&&item.portfolioDate.slice(0,7)===data.previousMonth);
    const previousRows=new Map(comparison?.previousDate.slice(0,7)===data.previousMonth?comparison.rows.map(row=>[companyKey(row.name),row] as const):[]);
    const holdings=new Map<string,{name:string;weight:number|null}>();
    for(const row of comparison?.rows??[]){
      if(row.currentQuantity>0)holdings.set(companyKey(row.name),{name:row.name,weight:row.weight});
    }
    for(const row of fund.holdings)holdings.set(companyKey(row.name),{name:row.name,weight:row.weight});
    return [...holdings.entries()].map(([key,holding])=>{
      const priorHolding=before?.holdings.find(row=>companyKey(row.name)===key);
      const priorRow=previousRows.get(key);
      const previousWeight=priorHolding?.weight??priorRow?.previousWeight??(priorRow?.previousQuantity===0?0:null);
      const change=holding.weight===null||previousWeight===null?null:Math.round((holding.weight-previousWeight)*100)/100;
      return {key:fund.id+":"+key,fundId:fund.id,fundName:fund.name,...holding,previousWeight,change};
    });
  }).sort((a,b)=>a.name.localeCompare(b.name,"en-IN")||a.fundName.localeCompare(b.fundName,"en-IN"));
}

export function searchCompanyHoldings(data:MonthlyPortfolio,query:string){
  return query.trim()?allCompanyHoldings(data).filter(holding=>matchesSearch(query,[holding.name])):[];
}

export function sharedCompanyHoldings(data:MonthlyPortfolio){
  const grouped=new Map<string,{name:string;funds:{id:string;name:string;weight:number|null}[]}>();
  for(const holding of allCompanyHoldings(data)){
    const key=companyKey(holding.name);
    const company=grouped.get(key)??{name:holding.name,funds:[]};
    company.funds.push({id:holding.fundId,name:holding.fundName,weight:holding.weight});
    grouped.set(key,company);
  }
  const companies=[...grouped.values()].filter(company=>company.funds.length>1).sort((a,b)=>b.funds.length-a.funds.length||a.name.localeCompare(b.name,"en-IN"));
  const fullFunds=data.funds.filter(fund=>data.fullComparisons.some(item=>item.fundId===fund.id&&item.currentDate===fund.portfolioDate&&item.rows.length>0)).length;
  return {companies,fullFunds,topOnlyFunds:data.funds.length-fullFunds,totalFunds:data.funds.length};
}
