import {ArrowUpRight} from "lucide-react";
import {nseSymbol} from "../lib/nse-security-links";
import "./nse-market-data.css";

export default function NseMarketData({company,isin}:{company:string;isin?:string}){
  const symbol=nseSymbol(company,isin);
  if(!symbol)return <span title="No verified NSE listing">{company}</span>;
  return <a className="nse-company-button" href={"/companies/"+encodeURIComponent(symbol)} aria-label={"View "+company+" market data"} title="View company market data">{company}<ArrowUpRight size={12} aria-hidden="true"/></a>;
}
