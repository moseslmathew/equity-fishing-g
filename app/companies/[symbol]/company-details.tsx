"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {ArrowLeft,ArrowUpRight,RefreshCw,TrendingUp} from "lucide-react";
import VolumeAnalysis from "./volume-analysis";
import type {NseSnapshot} from "../../../lib/nse-mcp";
const amount=(n:number|null|undefined)=>n==null?"Unavailable":"₹"+n.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const count=(n:number|null|undefined)=>n==null?"Unavailable":n.toLocaleString("en-IN");
const percent=(n:number|null|undefined)=>n==null?"Unavailable":(n>0?"+":"")+n.toFixed(2)+"%";
const tone=(n:number|null|undefined)=>n==null||n===0?"":n>0?"company-up":"company-down";
const time=(value:string|null|undefined)=>{if(!value)return "Timestamp unavailable";const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})+" IST":"Timestamp unavailable";};
function Metric({label,value,note,className=""}:{label:string;value:string;note?:string;className?:string}){return <div className="company-metric"><dt>{label}</dt><dd className={className}>{value}</dd>{note&&<small>{note}</small>}</div>;}
function Range({label,low,high,price}:{label:string;low:number|null;high:number|null;price:number|null}){
 const valid=low!==null&&high!==null&&high>=low;
 const position=valid&&price!==null&&high>low?Math.max(0,Math.min(100,(price-low)/(high-low)*100)):null;
 return <div className="company-range"><h3>{label}</h3><div className="company-range-labels"><span>Low<strong>{amount(low)}</strong></span><span>High<strong>{amount(high)}</strong></span></div>{valid&&<div className="company-range-track" aria-label={label+", low "+amount(low)+", high "+amount(high)+(price!==null?", last price "+amount(price):"")}>{position!==null&&<span style={{left:position+"%"}}/>}</div>}</div>;
}
export default function CompanyDetails({security}:{security:{symbol:string;name:string;isin:string}}){
 const [snapshot,setSnapshot]=useState<NseSnapshot|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [volumeRefresh,setVolumeRefresh]=useState(0);
 const active=useRef<AbortController|null>(null);
 const load=useCallback(async()=>{
  active.current?.abort();const controller=new AbortController();active.current=controller;setLoading(true);setError("");
  try{const response=await fetch("/api/nse?symbol="+encodeURIComponent(security.symbol),{signal:controller.signal,cache:"no-store"});const data=await response.json() as NseSnapshot & {error?:string};if(controller.signal.aborted)return;if(!response.ok&&!(data.live||data.eod))throw new Error(data.error||[...new Set([data.liveError,data.eodError].filter(Boolean))].join(" ")||"NSE data is temporarily unavailable. Please try again.");setSnapshot(data);}
  catch(e){if(!controller.signal.aborted){setError(e instanceof Error?e.message:"NSE data could not be loaded.");}}
  finally{if(!controller.signal.aborted)setLoading(false);}
 },[security.symbol]);
 useEffect(()=>{void load();return ()=>active.current?.abort();},[load]);
 const q=snapshot?.live,eod=snapshot?.eod;
 const distance=q?.price&&q.yearHigh?(q.price/q.yearHigh-1)*100:null;
 const fromLow=q?.price&&q.yearLow?(q.price/q.yearLow-1)*100:null;
 const dayRange=q?.high&&q.low&&q.low<=q.high?(q.high/q.low-1)*100:null;
 const quoteDate=q?.asOfIso?new Date(q.asOfIso).toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"}):null;
 const today=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"});
 return <div className="company-page"><header className="site-header"><a className="company-brand" href="/">Smallcap <span>OBSERVATORY</span></a><a className="company-back" href="/"><ArrowLeft size={15}/>Dashboard</a></header><main className="company-main">
 <a className="company-back company-back-top" href="/"><ArrowLeft size={15}/>Back to funds</a>
 <div className="company-title-row"><div><p className="company-eyebrow">NSE · {security.symbol}{q?" · "+q.series:""}</p><h1>{security.name}</h1><p className="company-isin">ISIN {security.isin}</p></div><div className="company-actions"><button disabled={loading} onClick={()=>{void load();setVolumeRefresh(n=>n+1);}}><RefreshCw size={15} className={loading?"company-spinning":""}/>{loading?"Loading":"Refresh"}</button><a href={"https://www.nseindia.com/get-quotes/equity?symbol="+encodeURIComponent(security.symbol)} target="_blank" rel="noopener noreferrer">View on NSE<ArrowUpRight size={15}/><span className="sr-only"> (new tab)</span></a></div></div>
 {error&&<div className="company-notice" role="alert">{error}<button onClick={()=>void load()}>Try again</button></div>}
 <div aria-busy={loading} className={loading?"company-content is-loading":"company-content"}>
 {loading&&!snapshot&&<div className="company-loading" role="status"><RefreshCw size={20} className="company-spinning"/>Fetching market data from NSE…</div>}
 {snapshot&&<>
 {q?<><section className="company-quote-panel" aria-label="Latest NSE quote"><div><span className="company-section-label">Last traded price</span><div className="company-price"><strong>{amount(q.price)}</strong><span className={tone(q.changePercent)}>{percent(q.changePercent)}<small>{q.change===null?"":amount(q.change)+" vs previous close"}</small></span></div><p className="company-time">{time(q.asOfIso)} · Delayed quote{quoteDate&&quoteDate!==today?" · Earlier trading session":""}</p></div><dl className="company-quick-metrics"><Metric label="30-day price change" value={percent(q.change30d)} className={tone(q.change30d)}/><Metric label="Session volume" value={count(q.volume)} note="Shares traded"/></dl></section>
 <section className="company-panel" aria-labelledby="company-range-title"><h2 id="company-range-title"><TrendingUp size={17}/>Price position</h2><div className="company-ranges"><Range label="52-week range" low={q.yearLow} high={q.yearHigh} price={q.price}/><Range label="Session range" low={q.low} high={q.high} price={q.price}/></div><dl className="company-position-metrics"><Metric label="From 52-week high" value={percent(distance)} note="Last price ÷ high − 1" className={tone(distance)}/><Metric label="Above 52-week low" value={percent(fromLow)} className={tone(fromLow)}/><Metric label="Session high–low spread" value={dayRange===null?"Unavailable":dayRange.toFixed(2)+"%"} note="High ÷ low − 1"/></dl></section>
 <section className="company-panel" aria-labelledby="company-session-title"><h2 id="company-session-title">Trading session</h2><dl className="company-session-metrics"><Metric label="Open" value={amount(q.open)}/><Metric label="Previous close" value={amount(q.previousClose)}/><Metric label="High" value={amount(q.high)}/><Metric label="Low" value={amount(q.low)}/></dl></section></>:<div className="company-notice" role="status">Latest quote unavailable. {snapshot.liveError}</div>}
 {eod?<section className="company-panel company-eod" aria-labelledby="company-eod-title"><div><h2 id="company-eod-title">Latest closing data</h2><p>{eod.date||"Date unavailable"} · NSE Bhavcopy</p></div><dl className="company-eod-metrics"><Metric label="Closing price" value={amount(eod.close)}/><Metric label="Full-session volume" value={count(eod.volume)} note="Shares traded"/></dl></section>:<p className="company-time">Closing data unavailable. {snapshot.eodError}</p>}
 <details className="company-sources"><summary>Sources and data notes</summary><p><a href="https://www.nseindia.com/nse-mcp" target="_blank" rel="noopener noreferrer">Official NSE MCP</a> · CM Market for quotes; Bhavcopy for closing data. Retrieved {time(snapshot.retrievedAt)}. Quote time above is NSE’s source timestamp, not the retrieval time.</p><p>NSE describes quotes as 1–3 minutes delayed. Older sessions remain dated. Price changes are not total returns; corporate actions can affect comparisons. Unavailable fields are never estimated.</p><p>Distance and range figures are calculated from NSE prices. P/E, market cap, earnings and delivery percentages are not supplied by these quote tools.</p></details>
 </>}
 <VolumeAnalysis symbol={security.symbol} series={q?.series??"EQ"} refreshToken={volumeRefresh}/>
 </div></main></div>;
}
