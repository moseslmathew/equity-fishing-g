"use client";
import {useState} from "react";
import {ArrowUpDown,ArrowUpRight,X} from "lucide-react";
import SearchField from "./search-field";
import {matchesSearch} from "../lib/search";
import {Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription,DialogClose} from "../components/ui/dialog";
import "./shared-table.css";

type SharedCompany={name:string;funds:{id:string;name:string;weight:number|null}[]};
type SortKey="name"|"funds"|"allocation";
const range=(company:SharedCompany)=>{const weights=company.funds.map(f=>f.weight).filter((weight):weight is number=>weight!==null);return {min:weights.length?Math.min(...weights):null,max:weights.length?Math.max(...weights):null,incomplete:weights.length<company.funds.length};};
const pct=(value:number|null)=>value===null?"Unavailable":value.toFixed(2)+"%";

export default function SharedHoldings({companies,month,pending,fullFunds,topOnlyFunds,totalFunds,missingFunds}:{companies:SharedCompany[];month:string;pending:boolean;fullFunds:number;topOnlyFunds:number;totalFunds:number;missingFunds:number}){
  const [search,setSearch]=useState("");
  const [sort,setSort]=useState<{key:SortKey;direction:1|-1}>({key:"funds",direction:-1});
  const rows=companies.filter(company=>matchesSearch(search,[company.name,...company.funds.map(fund=>fund.name)])).sort((a,b)=>{
    const result=sort.key==="name"?a.name.localeCompare(b.name,"en-IN"):sort.key==="funds"?a.funds.length-b.funds.length:(range(a).max??-1)-(range(b).max??-1);
    return result*sort.direction||a.name.localeCompare(b.name,"en-IN");
  });
  const changeSort=(key:SortKey)=>setSort(previous=>({key,direction:previous.key===key?(previous.direction===1?-1:1):key==="name"?1:-1}));
  const sortHeader=(key:SortKey,label:string)=><th scope="col" aria-sort={sort.key===key?(sort.direction===1?"ascending":"descending"):"none"}><button onClick={()=>changeSort(key)}>{label}<ArrowUpDown size={13} aria-hidden="true"/></button></th>;
  return <details className="shared-section shared-table-section">
    <summary className="shared-summary"><span className="shared-title">Shared holdings</span><span className="section-toggle" aria-hidden="true"/></summary>
    <div className="shared-content">
      <div className="shared-table-toolbar"><SearchField id="shared-holdings-search" label="Search shared companies or funds" placeholder="Search companies or funds…" value={search} onChange={setSearch}/><span role="status">{rows.length}{search.trim()?" of "+companies.length:""} companies · {month}</span></div>
      {rows.length>0?<div className="shared-table-scroll" tabIndex={0} aria-label="Shared holdings table"><table className="shared-holdings-table"><caption className="sr-only">Companies shared across funds’ saved portfolios for {month}</caption><thead><tr>{sortHeader("name","Company")}{sortHeader("funds","Funds")}{sortHeader("allocation","Allocation range")}</tr></thead><tbody>{rows.map(company=>{const allocation=range(company);return <tr key={company.name}><th scope="row">{company.name}</th><td><Dialog><DialogTrigger asChild><button className="shared-count-button" aria-label={"View "+company.funds.length+" funds holding "+company.name}>{company.funds.length} funds<ArrowUpRight size={14} aria-hidden="true"/></button></DialogTrigger><DialogContent className="research-popup shared-funds-popup" showCloseButton={false}><header className="research-popup-header"><div><DialogTitle className="research-popup-title">{company.name}</DialogTitle><DialogDescription>{company.funds.length} funds · {month} · Saved portfolio holdings</DialogDescription></div><DialogClose asChild><button className="research-popup-close" aria-label={"Close funds holding "+company.name}><X size={18} aria-hidden="true"/></button></DialogClose></header><div className="research-content research-popup-scroll"><table className="shared-fund-detail-table"><caption className="sr-only">Fund allocations to {company.name}</caption><thead><tr><th scope="col">Fund</th><th scope="col">Allocation</th></tr></thead><tbody>{[...company.funds].sort((a,b)=>(b.weight??-1)-(a.weight??-1)||a.name.localeCompare(b.name)).map(fund=><tr key={fund.id}><th scope="row">{fund.name}</th><td>{pct(fund.weight)}</td></tr>)}</tbody></table></div></DialogContent></Dialog></td><td>{allocation.min===null?"Unavailable":<>{pct(allocation.min)}<span className="shared-range-divider">–</span>{pct(allocation.max)}{allocation.incomplete&&<span className="shared-allocation-partial" title="Some fund allocations are unavailable"> · Partial</span>}</>}</td></tr>;})}</tbody></table></div>:<p className="shared-empty">{search.trim()?"No matching shared companies or funds.":pending?"Holdings are pending for this reporting month.":"No shared companies in the saved portfolios."}</p>}
      <p className="shared-table-note">{totalFunds} loaded funds · {fullFunds} full portfolios{topOnlyFunds>0?" · "+topOnlyFunds+" funds with saved top holdings only":""}{missingFunds>0?" · "+missingFunds+" funds pending":""}. Recalculated from the same portfolios as Fund Portfolios for the selected month. Allocation ranges use known weights; unavailable weights are not treated as zero.</p>
    </div>
  </details>;
}
