"use client";
import {useState} from "react";
import {ArrowUpDown,ArrowUpRight,X} from "lucide-react";
import SearchField from "./search-field";
import NseMarketData from "./nse-market-data";
import {matchesSearch} from "../lib/search";
import {Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription,DialogClose} from "../components/ui/dialog";
import "./shared-table.css";
import {fiiHistory,fiiQuarters,fiiCheckedAt} from "../lib/fii-quarterly";

type SharedCompany={name:string;isin?:string;funds:{id:string;name:string;weight:number|null}[]};
type SortKey="name"|"funds"|"allocation"|`fii:${string}`;
const range=(company:SharedCompany)=>{const weights=company.funds.map(f=>f.weight).filter((weight):weight is number=>weight!==null);return {min:weights.length?Math.min(...weights):null,max:weights.length?Math.max(...weights):null,incomplete:weights.length<company.funds.length};};
const pct=(value:number|null)=>value===null?"Unavailable":value.toFixed(2)+"%";

export default function SharedHoldings({companies,month,reportingMonth,pending,fullFunds,topOnlyFunds,totalFunds,missingFunds,open,onOpenChange}:{open?:boolean;onOpenChange?:(open:boolean)=>void;companies:SharedCompany[];month:string;reportingMonth:string;pending:boolean;fullFunds:number;topOnlyFunds:number;totalFunds:number;missingFunds:number}){
  const [search,setSearch]=useState("");
  const quarters=fiiQuarters(reportingMonth);
  const [sort,setSort]=useState<{key:SortKey;direction:1|-1}>({key:"funds",direction:-1});
  const rows=companies.filter(company=>matchesSearch(search,[company.name,...company.funds.map(fund=>fund.name)])).sort((a,b)=>{
    if(sort.key.startsWith("fii:")){
      const quarter=sort.key.slice(4),av=fiiHistory(a.name,a.isin)?.quarters[quarter],bv=fiiHistory(b.name,b.isin)?.quarters[quarter];
      if(av==null||bv==null)return av==null&&bv==null?a.name.localeCompare(b.name,"en-IN"):av==null?1:-1;
      return (av-bv)*sort.direction||a.name.localeCompare(b.name,"en-IN");
    }
    const result=sort.key==="name"?a.name.localeCompare(b.name,"en-IN"):sort.key==="funds"?a.funds.length-b.funds.length:(range(a).max??-1)-(range(b).max??-1);
    return result*sort.direction||a.name.localeCompare(b.name,"en-IN");
  });
  const changeSort=(key:SortKey)=>setSort(previous=>({key,direction:previous.key===key?(previous.direction===1?-1:1):key==="name"?1:-1}));
  const sortHeader=(key:SortKey,label:string,rowSpan=1)=><th key={key} rowSpan={rowSpan} scope="col" aria-sort={sort.key===key?(sort.direction===1?"ascending":"descending"):"none"}><button onClick={()=>changeSort(key)}>{label}<ArrowUpDown size={13} aria-hidden="true"/></button></th>;
  return <details id="portfolio-panel-shared" className="shared-section shared-table-section" open={open} onToggle={e=>onOpenChange?.(e.currentTarget.open)}>
    <summary className="shared-summary"><span className="shared-title">Shared holdings</span><span className="section-toggle" aria-hidden="true"/></summary>
    <div className="shared-content">
      <div className="shared-table-toolbar"><SearchField id="shared-holdings-search" label="Search shared companies or funds" placeholder="Search companies or funds…" value={search} onChange={setSearch}/><span role="status">{rows.length}{search.trim()?" of "+companies.length:""} companies · {month}</span></div>
      {rows.length>0?<div className="shared-table-scroll" tabIndex={0} aria-label="Shared holdings table"><table className="shared-holdings-table"><caption className="sr-only">Companies shared across funds’ saved portfolios for {month}</caption><thead><tr>{sortHeader("name","Company",2)}{sortHeader("funds","Funds",2)}{sortHeader("allocation","Allocation range",2)}<th scope="colgroup" colSpan={4} className="shared-fii-group">FII / FPI ownership <span>% of company equity</span></th></tr><tr>{quarters.map(q=>sortHeader(`fii:${q.key}`,q.label))}</tr></thead><tbody>{rows.map(company=>{const allocation=range(company),fii=fiiHistory(company.name,company.isin);return <tr key={company.name}><th scope="row"><NseMarketData company={company.name} isin={company.isin}/></th><td><Dialog><DialogTrigger asChild><button className="shared-count-button" aria-label={"View "+company.funds.length+" funds holding "+company.name}>{company.funds.length} funds<ArrowUpRight size={14} aria-hidden="true"/></button></DialogTrigger><DialogContent className="research-popup shared-funds-popup" showCloseButton={false}><header className="research-popup-header"><div><DialogTitle className="research-popup-title">{company.name}</DialogTitle><DialogDescription>{company.funds.length} funds · {month} · Saved portfolio holdings</DialogDescription></div><DialogClose asChild><button className="research-popup-close" aria-label={"Close funds holding "+company.name}><X size={18} aria-hidden="true"/></button></DialogClose></header><div className="research-content research-popup-scroll"><table className="shared-fund-detail-table"><caption className="sr-only">Fund allocations to {company.name}</caption><thead><tr><th scope="col">Fund</th><th scope="col">Allocation</th></tr></thead><tbody>{[...company.funds].sort((a,b)=>(b.weight??-1)-(a.weight??-1)||a.name.localeCompare(b.name)).map(fund=><tr key={fund.id}><th scope="row">{fund.name}</th><td>{pct(fund.weight)}</td></tr>)}</tbody></table></div></DialogContent></Dialog></td><td>{allocation.min===null?"Unavailable":<>{pct(allocation.min)}<span className="shared-range-divider">–</span>{pct(allocation.max)}{allocation.incomplete&&<span className="shared-allocation-partial" title="Some fund allocations are unavailable"> · Partial</span>}</>}</td>{quarters.map(q=>{const value=fii?.quarters[q.key];return <td key={q.key} className="shared-fii-value">{value==null?<span className="shared-fii-missing" aria-label={"FII ownership unavailable for "+q.label} title={"No published FII figure retrieved for "+q.label}>—</span>:<a href={fii!.source} target="_blank" rel="noreferrer" title={"FII/FPI ownership · "+q.label+" · Screener shareholding pattern"}>{pct(value)}</a>}</td>;})}</tr>;})}</tbody></table></div>:<p className="shared-empty">{search.trim()?"No matching shared companies or funds.":pending?"Holdings are pending for this reporting month.":"No shared companies in the saved portfolios."}</p>}
      <p className="shared-fii-note">FII / FPI: foreign institutional ownership of each company. Source: <a href="https://www.screener.in/" target="_blank" rel="noreferrer">Screener</a> · Checked {fiiCheckedAt}. — Unavailable; never treated as zero.</p>
      <p className="shared-table-note">{totalFunds} loaded funds · {fullFunds} full portfolios{topOnlyFunds>0?" · "+topOnlyFunds+" funds with saved top holdings only":""}{missingFunds>0?" · "+missingFunds+" funds pending":""}. Recalculated from the same portfolios as Fund Portfolios for the selected month. Allocation ranges use known weights; unavailable weights are not treated as zero.</p>
    </div>
  </details>;
}
