import directory from "../data/nse-equity-securities.json";
import {companyKey} from "./top-holdings";

// Official NSE security master, checked on directory.checkedAt. Exact identifiers
// only: never turn a partial company name into a guessed exchange symbol.
const byIsin=new Map<string,string>();
const byName=new Map<string,Set<string>>();
for(const [symbol,name,isin] of directory.securities){
  byIsin.set(isin,symbol);
  for(const key of [companyKey(name),companyKey(symbol)]){
    const symbols=byName.get(key)??new Set<string>();
    symbols.add(symbol);
    byName.set(key,symbols);
  }
}
export function nseSymbol(company:string,isin?:string):string|null{
  let symbol=isin?byIsin.get(isin):undefined;
  if(!symbol){
    const matches=byName.get(companyKey(company));
    if(matches?.size===1)symbol=matches.values().next().value;
  }
  return symbol??null;
}

export function nseQuoteUrl(company:string,isin?:string):string|null{
  const symbol=nseSymbol(company,isin);
  return symbol?"https://www.nseindia.com/get-quotes/equity?symbol="+encodeURIComponent(symbol):null;
}
export function nseSecurity(symbol:string){
  const row=directory.securities.find(row=>row[0]===symbol);
  return row?{symbol:row[0],name:row[1],isin:row[2]}:null;
}
