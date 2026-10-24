"use client";
import {Fragment,useState} from "react";
import {ArrowDownUp,ArrowUpRight,BookOpen,Building2,ChevronDown,Minus,Sprout,X} from "lucide-react";
import {Dialog,DialogClose,DialogContent,DialogDescription,DialogTitle} from "../components/ui/dialog";
import WorkspaceHeader from "./workspace-header";
import SearchField from "./search-field";
import {ventureCompanyMatches,ventureStatus,type VentureResearch,type VentureCompany,type VentureFirm} from "../lib/venture-capital";
import "./foreign-table.css";
import "./foreign-sidebar.css";
import "./foreign-compact.css";
import "./foreign-topline.css";
import "./venture-capital.css";

const date=(value:string)=>new Date(value+"T00:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"});
const statusLabels={snapshot:"Dated ownership",historical:"Historical snapshot",unknown:"Not confirmed",exited:"Reported full exit"};
const statusClass={snapshot:"existing",historical:"proposed",unknown:"existing",exited:"exited"};
type Sort="name-asc"|"name-desc"|"stake-desc"|"stake-asc";
type CompanyRow={company:VentureCompany;firm:VentureFirm};
const rowId=({company,firm}:CompanyRow)=>firm.id+":"+company.id;
const disclosedStake=(company:VentureCompany)=>{
 const values=company.holdings.map(h=>h.percent).filter((value):value is number=>value!==null);
 return values.length?Math.max(...values):null;
};
const qualifications=[
 "A percentage belongs to the named entity or explicitly reported group. Manager, general partner and fund disclosures can report the same shares; they are counted once.",
 "Company equity and fully diluted ownership use different denominators. The basis shown belongs to the source disclosure.",
 "Not confirmed does not mean zero. A stake can fall below reporting thresholds, be distributed to partners or be held under another entity name.",
 "Filing summary means the published summary was reviewed but the underlying exchange document was not fully verified. A dated snapshot is not confirmation of today’s holding.",
 "Historical investment success does not establish the merit or valuation of a listed share."
];

function OwnershipSummary({company}:{company:VentureCompany}){
 if(!company.holdings.length)return <><span>Current stake not confirmed</span><small>Pre-IPO backing documented</small></>;
 return <div className="vc-disclosures">{company.holdings.map((holding,i)=><div key={i}><span>{holding.percent===null?"Percentage not confirmed":holding.percent.toFixed(2)+"%"}{holding.shares!==null&&<span className="vc-summary-shares"> · {holding.shares.toLocaleString("en-IN")} shares</span>}</span><small>{holding.entity} · {date(holding.asOf)}</small><small>{holding.basis}</small></div>)}</div>;
}

function CompanyBody({company}:{company:VentureCompany}){
 return <div className="foreign-company-body vc-company-body">
  <section><h4>Before the public listing</h4><p>{company.entry}</p><a className="foreign-evidence" href={company.preIpoSource.url} target="_blank" rel="noreferrer">{company.preIpoSource.label}<ArrowUpRight size={13} aria-hidden="true"/></a></section>
  <section><h4>Ownership interpretation</h4><p>{company.note}</p>{company.reviewSource&&<a className="foreign-evidence" href={company.reviewSource.url} target="_blank" rel="noreferrer">{company.reviewSource.label}<ArrowUpRight size={13} aria-hidden="true"/></a>}</section>
  {company.holdings.length>0&&<div className="vc-ownership-scroll" tabIndex={0} role="region" aria-label={company.name+" disclosed ownership"}><table className="vc-ownership"><caption className="sr-only">Dated positions for {company.name}; figures are not live holdings.</caption><thead><tr><th scope="col">Holding entity</th><th scope="col">Shares</th><th scope="col">Ownership</th><th scope="col">As of</th></tr></thead><tbody>{company.holdings.map((holding,i)=><tr key={i}><th scope="row">{holding.entity}<small>{holding.evidence}</small></th><td>{holding.shares===null?"Not disclosed":holding.shares.toLocaleString("en-IN")}</td><td><strong>{holding.percent===null?"Not confirmed":holding.percent.toFixed(2)+"%"}</strong><small>{holding.basis}</small></td><td>{date(holding.asOf)}</td></tr>)}</tbody></table></div>}
  {ventureStatus(company)==="historical"&&<p className="foreign-qualification">Historical disclosure — current retained ownership needs reconciliation.</p>}
  {company.holdings.map((holding,i)=><section className="vc-source-note" key={i}><h4>{holding.entity}</h4><p>{holding.note}</p><a className="foreign-evidence" href={holding.source.url} target="_blank" rel="noreferrer">{holding.source.label}<ArrowUpRight size={13} aria-hidden="true"/></a></section>)}
 </div>;
}

export default function VentureCapital({research}:{research:VentureResearch}){
 const [firmId,setFirmId]=useState(research.firms[0].id);
 const [scope,setScope]=useState<"selected"|"all">("selected");
 const [query,setQuery]=useState("");
 const [ownership,setOwnership]=useState("all");
 const [sort,setSort]=useState<Sort>("name-asc");
 const [expanded,setExpanded]=useState<string[]>([]);
 const [popup,setPopup]=useState<"approach"|"brief"|null>(null);
 const firm=research.firms.find(item=>item.id===firmId)??research.firms[0];
 const firms=scope==="all"?research.firms:[firm];
 const available=firms.flatMap(item=>item.companies.map(company=>({company,firm:item})));
 const rows=available.filter(({company})=>ventureCompanyMatches(company,query)&&(ownership==="all"||ventureStatus(company)===ownership)).sort((a,b)=>{
  const byName=a.company.name.localeCompare(b.company.name,"en-IN");
  if(sort.startsWith("name"))return byName*(sort==="name-asc"?1:-1)||a.firm.name.localeCompare(b.firm.name);
  const av=disclosedStake(a.company),bv=disclosedStake(b.company);
  if(av===null||bv===null)return av===null&&bv===null?byName:av===null?1:-1;
  return (av-bv)*(sort==="stake-asc"?1:-1)||byName;
 });
 const disclosed=available.filter(({company})=>ventureStatus(company)==="snapshot").length;
 const title=scope==="all"?"All VC firms":firm.shortName;
 const reset=()=>{setQuery("");setOwnership("all");setExpanded([]);};
 const selectFirm=(id:string)=>{setFirmId(id);setScope("selected");setPopup(null);reset();};
 const toggle=(id:string)=>setExpanded(old=>old.includes(id)?old.filter(value=>value!==id):[...old,id]);
 const changeScope=(value:"selected"|"all")=>{setScope(value);setExpanded([]);setPopup(null);};
 const changeOwnership=(value:string)=>{setOwnership(value);setExpanded([]);};
 const sortBy=(column:"name"|"stake")=>setSort(previous=>column==="name"?(previous==="name-asc"?"name-desc":"name-asc"):(previous==="stake-desc"?"stake-asc":"stake-desc"));
 return <div className="dashboard foreign-dashboard vc-dashboard"><WorkspaceHeader section="venture"/>
  <main className="fund-main foreign-main foreign-workspace">
   <aside className="foreign-sidebar"><div className="foreign-sidebar-title"><Sprout size={17} aria-hidden="true"/><span>Venture capital</span></div>
    <nav aria-label="Venture capital firms">{research.firms.map(item=><button key={item.id} aria-current={item.id===firmId?"true":undefined} onClick={()=>selectFirm(item.id)}><span><strong>{item.shortName}</strong><small>{item.companies.length} reviewed companies</small></span><ChevronDown size={16} aria-hidden="true"/></button>)}</nav>
    <label className="foreign-mobile-picker"><span>Firm</span><select aria-label="Select venture capital firm" value={firmId} onChange={event=>selectFirm(event.target.value)}>{research.firms.map(item=><option key={item.id} value={item.id}>{item.shortName}</option>)}</select></label>
    <details className="foreign-sidebar-info"><summary>Review details</summary><p>Reviewed {date(research.reviewedAt)}</p><p>Indian-listed companies backed before IPO.</p><p>{research.firms.length} firms · {new Set(research.firms.flatMap(item=>item.companies.map(company=>company.id))).size} companies reviewed</p></details>
   </aside>
   <section className="foreign-coverage-main" aria-label={title+" venture capital coverage"}>
    <div className="foreign-topline"><div className="foreign-page-heading"><div className="foreign-compact-title"><h1>{title}</h1><span>Reviewed {date(research.reviewedAt)}</span></div></div>
     <div className="foreign-section-tabs" role="group" aria-label="Venture capital research section"><button aria-pressed={ownership!=="snapshot"} onClick={()=>changeOwnership("all")}>Company coverage<span>{available.length}</span></button><button aria-pressed={ownership==="snapshot"} onClick={()=>changeOwnership("snapshot")}>Dated ownership<span>{disclosed}</span></button></div>
     <div className="foreign-topline-actions">{scope==="selected"&&<button className="foreign-approach-button" onClick={()=>setPopup("approach")}><Building2 size={14} aria-hidden="true"/>Investment approach</button>}<button className="foreign-report-button" onClick={()=>setPopup("brief")}><BookOpen size={15} aria-hidden="true"/>Research brief</button></div>
    </div>
    <div className="foreign-toolbar"><div className="foreign-search-group"><div className="foreign-search-scope" role="group" aria-label="Venture capital company search scope"><button aria-pressed={scope==="selected"} onClick={()=>changeScope("selected")}>This firm</button><button aria-pressed={scope==="all"} onClick={()=>changeScope("all")}>All firms</button></div><SearchField id="vc-search" label={scope==="all"?"Search companies across all venture capital firms":"Search "+firm.shortName+" companies"} placeholder={scope==="all"?"Search across all firms…":"Search "+firm.shortName+" companies…"} value={query} onChange={value=>{setQuery(value);setExpanded([]);}}/></div>
     <details className="foreign-filter-menu"><summary>Filters<ChevronDown size={13} aria-hidden="true"/></summary><div className="foreign-filter-popover"><label><span className="sr-only">Ownership status</span><select aria-label="Ownership status" value={ownership} onChange={event=>changeOwnership(event.target.value)}><option value="all">All disclosures</option><option value="snapshot">Dated ownership</option><option value="historical">Historical only</option><option value="exited">Reported exits</option><option value="unknown">Not confirmed</option></select></label></div></details>
    </div>
    <div className="foreign-results"><p role="status">{rows.length} of {available.length} companies · Indian-listed equity · Ownership belongs to the named holder and stated date.</p><div className="vc-result-actions">{expanded.length>0&&<button className="foreign-evidence" onClick={()=>setExpanded([])}><Minus size={14} aria-hidden="true"/>Minimize all</button>}</div></div>
    {rows.length>0&&<div className="foreign-table-scroll" tabIndex={0} aria-label={title+" venture holdings table"}><table className="foreign-table vc-table"><caption className="sr-only">Pre-IPO investments, dated ownership and source evidence for {title}</caption><thead><tr><th scope="col" aria-sort={sort.startsWith("name")?(sort==="name-asc"?"ascending":"descending"):"none"}><button onClick={()=>sortBy("name")}>Company<ArrowDownUp size={12} aria-hidden="true"/></button></th><th scope="col">Market / listing</th><th scope="col">Ownership status</th><th scope="col" aria-sort={sort.startsWith("stake")?(sort==="stake-asc"?"ascending":"descending"):"none"}><button title="Sort by largest separately disclosed entity stake; positions are not summed" onClick={()=>sortBy("stake")}>Disclosed ownership<ArrowDownUp size={12} aria-hidden="true"/></button></th><th scope="col"><span className="sr-only">Details</span></th></tr></thead><tbody>{rows.map(row=>{const {company,firm:owner}=row,id=rowId(row),open=expanded.includes(id);return <Fragment key={id}><tr><th scope="row"><button className="foreign-company-link" aria-expanded={open} aria-controls={"vc-detail-"+id} onClick={()=>toggle(id)}>{company.name}</button>{scope==="all"&&<span className="foreign-investor-label">{owner.shortName}</span>}<small>{company.ticker}</small></th><td>Indian-listed equity<small>{company.listing}</small></td><td><span className={"foreign-direction "+statusClass[ventureStatus(company)]}>{statusLabels[ventureStatus(company)]}</span></td><td><OwnershipSummary company={company}/></td><td><button className="holdings-icon-toggle" aria-label={(open?"Minimize ":"Expand ")+company.name} aria-expanded={open} aria-controls={"vc-detail-"+id} onClick={()=>toggle(id)}>{open?<Minus size={16} aria-hidden="true"/>:<ChevronDown size={16} aria-hidden="true"/>}</button></td></tr>{open&&<tr id={"vc-detail-"+id}><td colSpan={5}><CompanyBody company={company}/></td></tr>}</Fragment>;})}</tbody></table></div>}
    {!rows.length&&<div className="vc-empty">{!available.length?<><h2>No verified Indian-listed investment identified.</h2><p>{firm.identityNote}</p><a className="foreign-evidence" href={firm.website} target="_blank" rel="noreferrer">Review the firm’s portfolio<ArrowUpRight size={14} aria-hidden="true"/></a></>:<><h2>No companies match these filters.</h2><p>Try a company name, ticker or a different ownership filter.</p><button className="foreign-evidence" onClick={reset}>Clear filters</button></>}</div>}
    <details className="foreign-coverage"><summary>Coverage and source limitations</summary><p>{research.scope}</p>{firms.map(item=><p key={item.id}><strong>{item.shortName}:</strong> {item.identityNote}</p>)}<ul>{qualifications.map(item=><li key={item}>{item}</li>)}</ul></details>
   </section>
  </main>
  <Dialog open={popup!==null} onOpenChange={open=>{if(!open)setPopup(null);}}><DialogContent className="foreign-popup" showCloseButton={false}><header className="foreign-popup-header"><div><DialogTitle>{title} · {popup==="approach"?"Investment approach":"Research brief"}</DialogTitle><DialogDescription>Indian-listed pre-IPO investments · Reviewed {date(research.reviewedAt)}</DialogDescription></div><DialogClose className="holdings-icon-toggle" aria-label="Close research"><X size={18} aria-hidden="true"/></DialogClose></header><div className="foreign-popup-body">{popup==="approach"?<><p className="foreign-report-deck">{firm.description}</p><p className="foreign-qualification">{firm.identityNote}</p><a className="foreign-evidence" href={firm.website} target="_blank" rel="noreferrer">Firm website<ArrowUpRight size={14} aria-hidden="true"/></a></>:<><p className="foreign-report-deck">{research.scope}</p>{firms.map(item=><section className="foreign-report-section" key={item.id}><h2>{item.name}</h2><p>{item.description}</p><p>{item.identityNote}</p><p>{item.companies.length} reviewed companies · {item.companies.filter(c=>ventureStatus(c)==="snapshot").length} with dated ownership evidence</p><a className="foreign-evidence" href={item.website} target="_blank" rel="noreferrer">Firm website<ArrowUpRight size={14} aria-hidden="true"/></a></section>)}<section className="foreign-report-section"><h2>How to read ownership</h2><ul className="vc-brief-notes">{qualifications.map(item=><li key={item}>{item}</li>)}</ul></section></>}</div></DialogContent></Dialog>
 </div>;
}
