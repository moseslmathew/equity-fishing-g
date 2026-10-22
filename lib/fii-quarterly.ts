import snapshot from "../data/fii-quarterly.json";
import {nseSymbol} from "./nse-security-links";

type History={quarters:Record<string,number|null>;source:string};
const securities:Record<string,History>=snapshot.securities;
export const fiiCheckedAt=new Date(snapshot.checkedAt).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Kolkata"});

// Company equity ownership is distinct from a fund's portfolio allocation.
// A quarter absent from the source is unknown, including pre-IPO quarters.
export function fiiHistory(company:string,isin?:string):History|null{
  const symbol=nseSymbol(company,isin);
  return symbol?securities[symbol]??null:null;
}

export function fiiQuarters(reportingMonth:string){
  // Align across every company, rather than shifting dates for late filers.
  const cutoff=reportingMonth<snapshot.checkedAt.slice(0,7)?reportingMonth:snapshot.checkedAt.slice(0,7);
  const [year,month]=cutoff.split("-").map(Number);
  const end=new Date(Date.UTC(year,Math.floor(month/3)*3,0));
  return Array.from({length:4},(_,i)=>{
    const date=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()-(3-i)*3+1,0));
    return {key:date.toISOString().slice(0,7),label:date.toLocaleDateString("en-GB",{month:"short",year:"numeric",timeZone:"UTC"})};
  });
}
