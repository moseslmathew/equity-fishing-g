"use client";
import ReviewStatus from "./review-status";
import {useState} from "react";
import {comparisonCounts,movement,netQuantity,type FullComparison,type FullHolding,type Movement} from "../lib/full-portfolio";
const number=(n:number)=>n.toLocaleString("en-IN");
const month=(s:string)=>new Date(s+"T00:00:00Z").toLocaleDateString("en-IN",{month:"long",year:"numeric",timeZone:"Asia/Kolkata"});
const shortMonth=(s:string)=>new Date(s+"T00:00:00Z").toLocaleDateString("en-IN",{month:"short",timeZone:"Asia/Kolkata"});
const labels:Record<Movement,string>={increased:"Increased",decreased:"Decreased",new:"New position",exited:"Exited",unchanged:"Unchanged",review:"Needs review"};
const deltaText=(row:FullHolding)=>{const d=netQuantity(row);return d===null?"—":(d>0?"+":"")+number(d);};
export default function FundAnalysis({name,comparison}:{name:string;comparison?:FullComparison}) {
  const [filter,setFilter]=useState<Movement|"changes"|"all">("changes");
  if(!comparison)return <section className="fund-analysis"><h2>Full portfolio changes</h2><p>A complete comparison for this reporting month is not yet saved.</p></section>;
  const c=comparison,counts=comparisonCounts(c);
  const increased=c.rows.filter(r=>movement(r)==="increased").sort((a,b)=>(netQuantity(b)??0)-(netQuantity(a)??0));
  const reduced=c.rows.filter(r=>movement(r)==="decreased").sort((a,b)=>(netQuantity(a)??0)-(netQuantity(b)??0));
  const highlight=(rows:FullHolding[])=>rows.slice(0,3).map(r=>r.name+" ("+deltaText(r)+" shares)").join(", ");
  const rows=c.rows.filter(r=>filter==="all"||filter==="changes"&&movement(r)!=="unchanged"||movement(r)===filter).sort((a,b)=>filter==="all"?(b.weight??-1)-(a.weight??-1):Math.abs(netQuantity(b)??0)-Math.abs(netQuantity(a)??0));
  const changed=counts.increased+counts.decreased+counts.new+counts.exited;
  const filters:[Movement|"changes"|"all",string,number][]=[["changes","All changes",changed+counts.review],["increased","Increased",counts.increased],["decreased","Decreased",counts.decreased],["new","New",counts.new],["exited","Exited",counts.exited],["all","All companies",c.rows.length]];
  if(counts.review)filters.push(["review","Needs review",counts.review]);
  return <section className="fund-analysis" aria-label={name+" full portfolio analysis"}>
    <h2>Full portfolio changes · {month(c.previousDate)} to {month(c.currentDate)}</h2>
    <p>{name} held {counts.current} company positions in {month(c.currentDate)}. Across the full equity portfolio, share counts increased in {counts.increased} existing positions and decreased in {counts.decreased}; {counts.new} were newly reported, {counts.exited} were no longer reported and {counts.unchanged} were unchanged.{counts.review>0?" "+counts.review+" company "+(counts.review===1?"comparison needs":"comparisons need")+" review.":""}</p>
    {increased.length>0&&<p><strong>Largest increases by number of shares:</strong> {highlight(increased)}.</p>}
    {reduced.length>0&&<p><strong>Largest decreases in continuing positions:</strong> {highlight(reduced)}.</p>}
    <p className="analysis-note">{c.basis==="provider_quantity_comparison"?"Third-party disclosure comparison. ":""}Changes below refer to share quantities, not changes in portfolio weight. They are net month-end movements; corporate actions may also affect quantities.</p>
    <div className="movement-filters" role="group" aria-label="Filter portfolio movements">{filters.map(([value,label,count])=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}<span>{count}</span></button>)}</div>
    <div className="movement-scroll" tabIndex={0} aria-label="Full portfolio movement table">
      <table className="movement-table"><caption className="sr-only">Company share quantities for {month(c.previousDate)} and {month(c.currentDate)}, with net changes</caption><thead><tr><th scope="col">Company</th><th scope="col">Movement</th><th scope="col">{shortMonth(c.previousDate)} shares</th><th scope="col">{shortMonth(c.currentDate)} shares</th><th scope="col">Net shares</th><th scope="col">Share change</th><th scope="col">{shortMonth(c.currentDate)} allocation</th></tr></thead><tbody>{rows.map(r=>{
        const status=movement(r),delta=netQuantity(r),percent=r.previousQuantity&&delta!==null?delta/r.previousQuantity*100:null;
        return <tr key={r.key}><th scope="row">{r.name}</th><td>{status==="review"?<ReviewStatus reasons={[r.note??"Prior quantity is unavailable; share movement cannot be confirmed."]}/>:<span className={"movement-label "+status}>{labels[status]}</span>}</td><td>{r.previousQuantity===null?"—":number(r.previousQuantity)}</td><td>{number(r.currentQuantity)}</td><td className={status==="increased"||status==="new"?"positive":status==="decreased"||status==="exited"?"negative":""}>{deltaText(r)}</td><td>{percent===null?"—":(percent>0?"+":"")+percent.toFixed(1)+"%"}</td><td>{r.weight===null?"—":r.weight.toFixed(2)+"%"}</td></tr>;
      })}</tbody></table>
      {rows.length===0&&<p className="movement-empty">No {filter==="decreased"?"decreases in continuing positions":filter==="exited"?"company exits":filter==="new"?"new company positions":"movements in this group"} reported for this comparison.</p>}
    </div>
    <details className="analysis-method"><summary>Sources and comparison method</summary><p>Checked {new Date(c.checkedAt).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})} IST. Previous quantities are reconstructed from the provider’s current quantity and its reported net change.</p><ul>{c.sources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a> · {s.scope}</li>)}</ul>{c.notes.map((note,i)=><p key={i}>{note}</p>)}<p>“New” and “Exited” mean a company appears in only one month’s disclosure, subject to identifier changes and corporate actions. No quantities are inferred from changes in allocation percentages.</p></details>
  </section>;
}
