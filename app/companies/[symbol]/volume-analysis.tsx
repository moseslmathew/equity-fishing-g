"use client";
import {useEffect,useState} from "react";
import {BarChart3,Lightbulb,RefreshCw} from "lucide-react";
import type {VolumeReport} from "../../../lib/nse-volume";
import {savedVolumeReport,mergeVolumeReports} from "../../../lib/volume-history";
import {Tooltip,TooltipTrigger,TooltipContent,TooltipProvider} from "../../../components/ui/tooltip";
import {volumeBuckets,bucketInsights,type VolumeView,type VolumeBucket} from "../../../lib/volume-trends";
const count=(n:number|null)=>n===null?"Unavailable":Math.round(n).toLocaleString("en-IN");
const day=(d:string)=>new Date(d+"T00:00:00Z").toLocaleDateString("en-IN",{day:"numeric",month:"short",timeZone:"UTC"});
function recentMonths(today:string){return Array.from({length:5},(_,i)=>{const d=new Date(today.slice(0,7)+"-01T00:00:00Z");d.setUTCMonth(d.getUTCMonth()-i);return d.toISOString().slice(0,7);});}
function periodTitle(bucket:VolumeBucket){return day(bucket.from)+(bucket.from===bucket.to?"":" – "+day(bucket.to));}
function VolumeChartBar({bucket,max,view,selected,onPreview,onSelect}:{bucket:VolumeBucket;max:number;view:VolumeView;selected:boolean;onPreview:(key:string|null)=>void;onSelect:(key:string)=>void}){
 const available=!bucket.incomplete;
 return <Tooltip><TooltipTrigger asChild><button type="button" className={"volume-chart-group"+(bucket.incomplete?" volume-group-incomplete":"")+(selected?" volume-group-selected":"")} aria-label={"Select volume for "+periodTitle(bucket)} aria-pressed={selected} onMouseEnter={()=>onPreview(bucket.key)} onMouseLeave={()=>onPreview(null)} onFocus={()=>onPreview(bucket.key)} onBlur={()=>onPreview(null)} onClick={()=>onSelect(bucket.key)}><span className="volume-paired-bars"><span className="volume-traded-bar" style={{height:Math.max(1,bucket.volume/max*100)+"%"}}/><span className="volume-delivered-bar" style={{height:bucket.delivery===null?"0%":Math.max(1,bucket.delivery/max*100)+"%"}}/></span><span className="volume-bar-label">{bucket.label}{bucket.partial&&<small>{view==="weekly"?"WTD":"MTD"}</small>}{bucket.incomplete&&<small>Incomplete</small>}</span></button></TooltipTrigger>
 <TooltipContent className="volume-tooltip" side="top" sideOffset={10} collisionPadding={16}><div className="volume-tooltip-heading"><strong>{periodTitle(bucket)}</strong><span>{bucket.sessions} trading {bucket.sessions===1?"session":"sessions"}{bucket.partial?" · In progress":""}</span></div><dl><div><dt><i className="volume-tip-traded"/>Traded shares</dt><dd>{available?count(bucket.volume):"Unavailable"}</dd></div><div><dt><i className="volume-tip-delivered"/>Delivered shares</dt><dd>{available?count(bucket.delivery):"Unavailable"}</dd></div><div className="volume-tooltip-percent"><dt>Delivery</dt><dd>{available&&bucket.deliveryPercent!==null?bucket.deliveryPercent.toFixed(2)+"%":"Unavailable"}</dd></div></dl>{bucket.incomplete&&<p>Some source reports are missing.</p>}</TooltipContent></Tooltip>;
}
export default function VolumeAnalysis({symbol,series,refreshToken}:{symbol:string;series:string;refreshToken:number}){
 const [reports,setReports]=useState<Record<string,VolumeReport>>({}),[done,setDone]=useState<string[]>([]),[errors,setErrors]=useState<string[]>([]),[retry,setRetry]=useState(0),[view,setView]=useState<VolumeView>("daily");
 const [selectedKey,setSelectedKey]=useState<string|null>(null),[previewKey,setPreviewKey]=useState<string|null>(null);
 const today=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"}),months=recentMonths(today);
 useEffect(()=>{const controller=new AbortController();setReports({});setDone([]);setErrors([]);let next=0;
 const checkMonth=async(month:string)=>{let saved:VolumeReport|null=null;
 try{const snapshot=await fetch("/nse-volume/"+month+"/"+encodeURIComponent(symbol[0])+".json",{signal:controller.signal});if(snapshot.ok)saved=savedVolumeReport(await snapshot.json(),symbol,series,month);}catch{/* A missing saved report falls back to the live archive reader. */}
 if(saved&&!controller.signal.aborted){setReports(old=>({...old,[month]:saved!}));setDone(old=>old.includes(month)?old:[...old,month]);}
 if(saved&&month!==today.slice(0,7))return;
 try{const response=await fetch("/api/nse/volume?symbol="+encodeURIComponent(symbol)+"&series="+encodeURIComponent(series)+"&month="+month,{signal:controller.signal,cache:"no-store"});const data=await response.json() as VolumeReport&{error?:string};if(!response.ok)throw new Error(data.error||"NSE history unavailable for "+month);if(!controller.signal.aborted)setReports(old=>({...old,[month]:mergeVolumeReports(saved,data)}));}catch{if(!controller.signal.aborted&&!saved)setErrors(old=>[...old,month]);}finally{if(!controller.signal.aborted)setDone(old=>old.includes(month)?old:[...old,month]);}};
 void Promise.all(Array.from({length:2},async()=>{while(next<5&&!controller.signal.aborted)await checkMonth(recentMonths(today)[next++]);}));return()=>controller.abort();},[symbol,series,refreshToken,retry,today]);
 const needed=view==="daily"?1:view==="weekly"?2:5,loading=months.slice(0,needed).some(month=>!done.includes(month));
 const rows=Object.values(reports).flatMap(r=>r.rows),failed=Object.values(reports).flatMap(r=>r.failedDates);
 const buckets=volumeBuckets(rows,view,failed,today),incomplete=buckets.some(b=>b.incomplete)||errors.some(month=>view==="monthly"||months.slice(0,needed).includes(month));
 const activeBucket=buckets.find(bucket=>bucket.key===(previewKey??selectedKey))??null;
 const visibleBuckets=activeBucket?[activeBucket]:buckets;
 const summaryIncomplete=activeBucket?activeBucket.incomplete:incomplete;
 const total=visibleBuckets.reduce((n,b)=>n+b.volume,0),delivery=visibleBuckets.every(b=>b.delivery!==null)?visibleBuckets.reduce((n,b)=>n+b.delivery!,0):null;
 const deliveryPct=total&&delivery!==null?delivery/total*100:null,max=Math.max(1,...buckets.map(b=>b.volume));
 const insights=incomplete?["Some NSE reports are unavailable. Insights are withheld until the selected periods can be checked in full."]:bucketInsights(buckets,view);
 const label=view==="daily"?"days":view==="weekly"?"weeks":"months";
 const sources=[...new Map(rows.map(row=>[row.date,row])).values()].sort((a,b)=>b.date.localeCompare(a.date));
 return <section className="company-panel company-volume" aria-labelledby="volume-title"><div className="volume-heading"><h2 id="volume-title"><BarChart3 size={17}/>Delivery volume percentage</h2><span>NSE · {series}</span></div>
 <div className="volume-tabs" role="group" aria-label="Volume timeframe">{(["daily","weekly","monthly"] as const).map(value=><button key={value} aria-pressed={view===value} onClick={()=>{setView(value);setSelectedKey(null);setPreviewKey(null);}}>{value[0].toUpperCase()+value.slice(1)}</button>)}</div>
 <div className="volume-comparison" aria-busy={loading}><div className="volume-period-header"><div className="volume-period-label" aria-live="polite">{activeBucket?periodTitle(activeBucket):"Last "+(buckets.length||5)+" "+label}{!loading&&(activeBucket?activeBucket.partial:buckets.some(b=>b.partial))?" · In progress":""}</div>{!loading&&buckets.length>0&&<button type="button" className="volume-show-all" aria-pressed={!activeBucket} onClick={()=>{setSelectedKey(null);setPreviewKey(null);}}>All {buckets.length} {label}</button>}</div>
 {loading?<div className="volume-loading" role="status"><RefreshCw size={16} className="company-spinning"/>Loading NSE history… {done.length}/5 months checked</div>:!buckets.length?<div className="volume-loading" role="status">No published volume history available. <button className="volume-retry" onClick={()=>setRetry(n=>n+1)}>Retry</button></div>:<>
 <div className="volume-overview"><dl className="volume-statistics"><div><dt><i/>Total traded volume</dt><dd>{summaryIncomplete?"Unavailable":count(total)}</dd></div><div><dt><i/>Delivery volume</dt><dd>{summaryIncomplete?"Unavailable":count(delivery)}</dd></div><div><dt>Delivery percentage</dt><dd>{!summaryIncomplete&&deliveryPct!==null?deliveryPct.toFixed(2)+"%":"Unavailable"}</dd></div></dl>
 <TooltipProvider delayDuration={100}><div className="volume-paired-chart" role="group" aria-label={"Select a bar to view traded and delivery volumes for "+label}>{buckets.map(bucket=><VolumeChartBar key={bucket.key} bucket={bucket} max={max} view={view} selected={selectedKey===bucket.key} onPreview={setPreviewKey} onSelect={setSelectedKey}/>)}</div></TooltipProvider></div>

 <div className="volume-insights"><h3><Lightbulb size={13}/>Insights</h3><ul>{insights.map(text=><li key={text}>{text}</li>)}</ul></div>
 </>}
 </div>
 {!loading&&buckets.length>0&&<details className="company-sources"><summary>Dates, sources & calculation</summary><p>Daily shows the last 5 available sessions. Weekly groups trading sessions into calendar weeks (Monday–Sunday); monthly uses calendar months. The current week/month is marked WTD/MTD and is excluded from full-period volume comparisons. Totals cover all displayed bars until a bar is hovered, focused or selected. Click a bar to keep its values; use “All” to restore the combined view. Delivery % = total delivered shares ÷ total traded shares; missing values are not estimated.</p><p>Insights use observed volume and delivery only. Delivery does not identify investors or establish buying, selling, accumulation or future price direction.</p><p>{buckets.map(b=>b.label+": "+day(b.from)+"–"+day(b.to)+" ("+b.sessions+" sessions)").join(" · ")}. History available for {Object.keys(reports).length} of 5 months. Saved official reports retain their retrieval dates; the current month is checked for newer reports.</p>{incomplete&&<p>Some source reports could not be checked. Incomplete totals and insights are withheld. <button className="volume-retry" onClick={()=>setRetry(n=>n+1)}>Retry reports</button></p>}<p>Report retrieval dates: {[...new Set(Object.values(reports).map(r=>new Date(r.retrievedAt).toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata"})))].join(", ")}. Current archive reads may be reused for 10 minutes.</p><div className="volume-source-links">{sources.map(row=><a key={row.date} href={row.source} target="_blank" rel="noopener noreferrer">NSE · {day(row.date)}</a>)}</div></details>}
 </section>;
}
