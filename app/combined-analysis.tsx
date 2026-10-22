"use client";
import {Fragment,useMemo,useState} from "react";
import {ArrowUpDown,ChevronDown,ChevronUp,ArrowUp,ArrowDown,Sparkles,X} from "lucide-react";
import {combinedAnalysis,type CombinedCompany,type CombinedMovement} from "../lib/combined-analysis";
import type {FullComparison,Movement} from "../lib/full-portfolio";
import {Tooltip,TooltipContent,TooltipProvider,TooltipTrigger} from "../components/ui/tooltip";
import SearchField from "./search-field";
import "./combined-analysis.css";

const number=(n:number)=>n.toLocaleString("en-IN");
const quantity=(n:number|null)=>n===null?"—":number(n);
const signed=(n:number|null)=>n===null?"Withheld":(n>0?"+":"")+number(n);
const monthLabel=(s:string)=>new Date(s+"-01T00:00:00Z").toLocaleDateString("en-IN",{month:"long",year:"numeric",timeZone:"Asia/Kolkata"});
const labels:Record<CombinedMovement|string,string>={increased:"Net increase",decreased:"Net decrease",new:"New across funds",exited:"Exited across funds",unchanged:"Unchanged",mixed:"Balanced changes",review:"Needs review"};
const fundLabels:Record<Movement,string>={increased:"Increased",decreased:"Decreased",new:"New position",exited:"Exited",unchanged:"Unchanged",review:"Needs review"};
type Filter="changes"|"increased"|"decreased"|"new"|"exited"|"mixed"|"all"|"review";
type SortColumn="name"|"status"|"adding"|"reducing"|"previousQuantity"|"currentQuantity"|"delta";
const columns:[SortColumn,string][]=[["name","Company"],["status","Share-count movement"],["adding","Funds adding"],["reducing","Funds reducing"],["previousQuantity","Previous shares"],["currentQuantity","Current shares"],["delta","Net share change"]];
function FundCountTooltip({company,direction}:{company:CombinedCompany;direction:"adding"|"reducing"}){
  const adding=direction==="adding",funds=company.funds.filter(f=>adding?f.status==="increased"||f.status==="new":f.status==="decreased"||f.status==="exited");
  return <Tooltip><TooltipTrigger asChild><button className={"fund-count-trigger "+(adding?"positive":"negative")} aria-label={funds.length+" funds "+(adding?"adding to ":"reducing ")+company.name}>{adding?"+":"−"} {funds.length}</button></TooltipTrigger><TooltipContent className="fund-count-tooltip" side="top" align="start" sideOffset={8} collisionPadding={16}><strong>{adding?"Funds adding shares":"Funds reducing shares"}</strong><span className="fund-count-company">{company.name}</span>{funds.length?<ul>{funds.map(f=><li key={f.fundId}><span>{f.name}</span><small>{fundLabels[f.status]}</small></li>)}</ul>:<p>No funds {adding?"added":"reduced"} shares in this comparison.</p>}</TooltipContent></Tooltip>;
}
export default function CombinedAnalysis({comparisons,month,open,onOpenChange}:{comparisons:FullComparison[];month:string;open?:boolean;onOpenChange?:(open:boolean)=>void}){
  const result=useMemo(()=>combinedAnalysis(comparisons,month),[comparisons,month]);
  const [filter,setFilter]=useState<Filter>("changes"),[expanded,setExpanded]=useState<string[]>([]);
  const [query,setQuery]=useState("");
  const [sort,setSort]=useState<{column:SortColumn;direction:"asc"|"desc"}|null>(null);
  const matches=(c:CombinedCompany,value:Filter)=>value==="all"||value==="changes"&&c.changed||value==="mixed"&&c.mixed||value!=="mixed"&&c.status===value;
  const filters:[Filter,string][]=[["changes","All changes"],["mixed","Mixed directions"],["all","All companies"],["review","Needs review"]];
  const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const rows=result.companies.filter(c=>matches(c,filter)&&terms.every(term=>c.name.toLocaleLowerCase().includes(term))).sort((a,b)=>{
    if(!sort)return 0;
    const value=(c:CombinedCompany)=>sort.column==="status"?labels[c.status]:c[sort.column];
    const av=value(a),bv=value(b);
    if(av===null||bv===null)return av===bv?a.name.localeCompare(b.name):av===null?1:-1;
    const comparison=typeof av==="string"&&typeof bv==="string"?av.localeCompare(bv):Number(av)-Number(bv);
    return comparison*(sort.direction==="asc"?1:-1)||a.name.localeCompare(b.name);
  });
  const sortBy=(column:SortColumn)=>setSort(current=>({column,direction:current?.column===column&&current.direction==="asc"?"desc":"asc"}));
  const toggle=(key:string)=>setExpanded(items=>items.includes(key)?items.filter(item=>item!==key):[...items,key]);
  const close=(key:string)=>{setExpanded(items=>items.filter(item=>item!==key));requestAnimationFrame(()=>{document.getElementById("combined-company-"+key)?.focus();});};
  return <TooltipProvider delayDuration={120}><details id="portfolio-panel-combined" className="combined-section compact-combined" open={open} onToggle={e=>onOpenChange?.(e.currentTarget.open)}>
    <summary className="combined-summary"><span className="combined-summary-copy"><span className="combined-title">Combined portfolio analysis</span><span className="comparison-badge">vs {monthLabel(result.previousMonth)}</span></span><span className="section-toggle" aria-hidden="true"/></summary>
    <div className="combined-content">
      {!result.coverage?<p className="shared-empty">No complete portfolio comparisons are saved for {monthLabel(month)}. Choose an earlier reporting month.</p>:<>
        <div className="combined-stats">{([{value:"increased",label:"Net increased",tag:"Accumulating",Icon:ArrowUp},{value:"decreased",label:"Net decreased",tag:"Trimming",Icon:ArrowDown},{value:"new",label:"New across funds",tag:"Fresh entries",Icon:Sparkles},{value:"exited",label:"Exited across funds",tag:"Exits",Icon:X}] as const).map(({value,label,tag,Icon})=><button key={value} className={"combined-stat "+value} aria-pressed={filter===value} aria-label={"Filter "+label+" companies"} onClick={()=>{setFilter(filter===value?"changes":value);setExpanded([]);}}><span className="combined-stat-top"><span className="combined-stat-tag">{tag}</span><Icon size={16} aria-hidden="true"/></span><strong>{result.companies.filter(c=>c.status===value).length}</strong><span className="combined-stat-label">{label}</span></button>)}</div>
        <div className="combined-controls"><SearchField id="combined-company-search" label="Search combined portfolio companies" placeholder="Search companies…" value={query} onChange={value=>{if(value&&!query)setFilter("all");setQuery(value);setExpanded([]);}}/><div className="movement-filters combined-filters" role="group" aria-label="Filter combined portfolio movements">{filters.map(([value,label])=><button key={value} aria-pressed={filter===value} onClick={()=>{setFilter(value);setExpanded([]);}}>{label}<span>{result.companies.filter(c=>matches(c,value)).length}</span></button>)}</div>
</div>
        <div className="combined-results">{(query||filter!=="changes")&&<button onClick={()=>{setQuery("");setFilter("changes");setExpanded([]);}}>Reset view</button>}</div><div className="combined-scroll" tabIndex={0} aria-label="Combined company share changes">
          <table className="combined-table"><caption className="sr-only">Combined share quantities across available fund portfolios, with individual fund changes</caption><thead><tr>{columns.filter(([column])=>column!=="adding"&&column!=="reducing").map(([column,label],index)=><Fragment key={column}>{index===2&&<th scope="col" className="combined-funds-heading" aria-sort={sort?.column==="adding"||sort?.column==="reducing"?(sort.direction==="asc"?"ascending":"descending"):"none"}><span>Funds</span><div>{(["adding","reducing"] as const).map(direction=><button key={direction} className="combined-sort-button" onClick={()=>sortBy(direction)} aria-label={"Sort funds "+direction+" "+(sort?.column===direction&&sort.direction==="asc"?"descending":"ascending")}>{direction==="adding"?"More shares":"Fewer shares"}{sort?.column===direction?(sort.direction==="asc"?<ChevronUp size={13} aria-hidden="true"/>:<ChevronDown size={13} aria-hidden="true"/>):<ArrowUpDown size={12} aria-hidden="true"/>}</button>)}</div></th>}<th scope="col" aria-sort={sort?.column===column?(sort.direction==="asc"?"ascending":"descending"):"none"}><button className="combined-sort-button" onClick={()=>sortBy(column)} aria-label={"Sort by "+label+" "+(sort?.column===column&&sort.direction==="asc"?"descending":"ascending")}>{label}{sort?.column===column?(sort.direction==="asc"?<ChevronUp size={15} aria-hidden="true"/>:<ChevronDown size={15} aria-hidden="true"/>):<ArrowUpDown size={14} aria-hidden="true"/>}</button></th></Fragment>)}</tr></thead><tbody>{rows.map(c=>{const open=expanded.includes(c.key);return <Fragment key={c.key}>
            <tr className={open?"combined-company-row is-open":"combined-company-row"}><th scope="row"><button id={"combined-company-"+c.key} className="combined-company-button" aria-expanded={open} aria-controls={"combined-detail-"+c.key} onClick={()=>toggle(c.key)}><ChevronDown size={17} aria-hidden="true"/><span>{c.name}<small><span className="company-fund-badge">{c.funds.filter(f=>f.currentQuantity>0).length} holding{c.funds.some(f=>f.status==="exited")?" · "+c.funds.filter(f=>f.status==="exited").length+" exited":""}</span>{c.mixed?" · Mixed directions":""}</small></span></button></th><td><span className={"movement-label "+c.status}>{labels[c.status]}</span></td><td><div className="combined-directions"><FundCountTooltip company={c} direction="adding"/><FundCountTooltip company={c} direction="reducing"/></div>{c.funds.some(f=>f.status==="unchanged")&&<small className="combined-unchanged-count">{c.funds.filter(f=>f.status==="unchanged").length} unchanged</small>}{c.review>0&&<small className="combined-review-count">{c.review} review</small>}</td><td>{quantity(c.previousQuantity)}</td><td>{quantity(c.currentQuantity)}</td><td className={c.delta!==null&&c.delta>0?"positive":c.delta!==null&&c.delta<0?"negative":""}>{signed(c.delta)}</td></tr>
            {open&&<tr className="combined-detail-row"><td colSpan={6}><div id={"combined-detail-"+c.key} className="combined-detail"><div className="combined-detail-heading"><strong>{c.name}</strong><button type="button" className="combined-collapse-icon" aria-label={"Collapse "+c.name+" fund details"} title="Collapse details" onClick={()=>close(c.key)}><ChevronUp size={17} aria-hidden="true"/></button></div><table className="combined-fund-table"><caption className="sr-only">Individual fund contributions for {c.name}</caption><thead><tr><th scope="col">Fund</th><th scope="col">Share movement</th><th scope="col">Previous shares</th><th scope="col">Current shares</th><th scope="col">Net share change</th><th scope="col">Portfolio allocation %</th></tr></thead><tbody>{c.funds.map(f=><tr key={f.fundId}><th scope="row">{f.name}{f.note&&<span className="movement-row-note">{f.note}</span>}</th><td><span className={"movement-label "+f.status}>{fundLabels[f.status]}</span></td><td>{quantity(f.previousQuantity)}</td><td>{quantity(f.currentQuantity)}</td><td className={f.delta!==null&&f.delta>0?"positive":f.delta!==null&&f.delta<0?"negative":""}>{signed(f.delta)}</td><td>{f.weight===null?"—":f.weight.toFixed(2)+"%"}</td></tr>)}</tbody></table></div></td></tr>}
          </Fragment>;})}</tbody></table>
          {rows.length===0&&<p className="movement-empty">{query.trim()?"No matching companies in this view. Try a shorter name or choose All companies.":"No companies in this group for the selected comparison."}</p>}
        </div>

      </>}
    </div>
  </details></TooltipProvider>;
}
