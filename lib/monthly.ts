import september from "../data/september-portfolios.json";
import type {Fund, Portfolio} from "./portfolio";
import {ids} from "./portfolio";
import type {FullComparison} from "./full-portfolio";
import {readFullComparisons} from "./full-portfolio-store";
import {withTopHoldings} from "./top-holdings";

export type MonthlyPortfolio = Portfolio & {
  requestedMonth:string;
  calendarMonth:string;
  previousMonth:string;
  availableMonths:string[];
  missingFunds:string[];
  previousFunds:Fund[];
  fullComparisons:FullComparison[];
};
export const validMonth=(value:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value);
export function monthBefore(value:string) {
  const [year,month]=value.split("-").map(Number);
  return new Date(Date.UTC(year,month-2,1)).toISOString().slice(0,7);
}
export function calendarMonth(now=new Date()) {
  const parts=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",timeZone:"Asia/Kolkata"}).formatToParts(now);
  return parts.find(p=>p.type==="year")!.value+"-"+parts.find(p=>p.type==="month")!.value;
}
const prefix="portfolio/months/";
export async function archivePortfolio(bucket:R2Bucket,snapshot:Portfolio) {
  await Promise.all(snapshot.funds.filter(f=>f.verification!=="conflict"&&f.checkStatus!=="failed"&&f.checkStatus!=="conflict").map(f=>bucket.put(prefix+f.portfolioDate.slice(0,7)+"/"+f.id+".json",JSON.stringify(f),{httpMetadata:{contentType:"application/json"}})));
}
async function readMonth(_bucket:R2Bucket,month:string,_current:Portfolio,_baseline:Portfolio) {return (await import("./database-store")).readDatabaseFunds(month);}
export async function monthlyPortfolio(bucket:R2Bucket,current:Portfolio,baseline:Portfolio,selection:string):Promise<MonthlyPortfolio> {
  const availableMonths=await (await import("./database-store")).availableDatabaseMonths();
  const requestedMonth=selection==="latest"?availableMonths[0]:selection;
  const previousMonth=monthBefore(requestedMonth);
  const [y,m]=requestedMonth.split("-").map(Number);
  const nextMonth=new Date(Date.UTC(y,m,1)).toISOString().slice(0,7);
  const [savedFunds,savedPreviousFunds,fullComparisons,previousComparisons,nextComparisons]=await Promise.all([readMonth(bucket,requestedMonth,current,baseline),readMonth(bucket,previousMonth,current,baseline),readFullComparisons(bucket,requestedMonth),readFullComparisons(bucket,previousMonth),readFullComparisons(bucket,nextMonth)]);
  const funds=savedFunds.map(f=>withTopHoldings(f,fullComparisons.find(c=>c.fundId===f.id)??nextComparisons.find(c=>c.fundId===f.id&&c.previousDate===f.portfolioDate)));
  const previousFunds=savedPreviousFunds.map(f=>withTopHoldings(f,previousComparisons.find(c=>c.fundId===f.id)??fullComparisons.find(c=>c.fundId===f.id&&c.previousDate===f.portfolioDate)));
  const checkedAt=[current.checkedAt,...funds.map(f=>f.lastCheckedAt)].sort().at(-1)!;
  return {...current,checkedAt,requestedMonth,previousMonth,calendarMonth:calendarMonth(),availableMonths,funds,previousFunds,fullComparisons,missingFunds:ids.filter(id=>!funds.some(f=>f.id===id))};
}
