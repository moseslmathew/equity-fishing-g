"use client";
import {useEffect,useState} from "react";
import {RotateCw,ChevronDown} from "lucide-react";
import type {MonthlyPortfolio} from "../lib/monthly";
import {schemeNames} from "../lib/fund-catalog";
import FundBrowser from "./fund-browser";
import SharedHoldings from "./shared-holdings";
import {sharedCompanyHoldings} from "../lib/fund-search";
import CombinedAnalysis from "./combined-analysis";
import AgentResearch from "./agent-research";
import AceInvestors from "./ace-investors";
import WorkspaceHeader from "./workspace-header";
const time=(s:string)=>new Date(s).toLocaleString("en-IN",{day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit",timeZone:"Asia/Kolkata"})+" IST";
const monthLabel=(s:string)=>new Date(s+"-01T00:00:00Z").toLocaleDateString("en-IN",{month:"long",year:"numeric",timeZone:"Asia/Kolkata"});
const previousMonth=(s:string)=>{const [y,m]=s.split("-").map(Number);return new Date(Date.UTC(y,m-2,1)).toISOString().slice(0,7);};
export default function Dashboard(){
  const [data,setData]=useState<MonthlyPortfolio|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[requestedMonth,setRequestedMonth]=useState("latest");
  const [section,setSection]=useState<"funds"|"investors">("funds");
  const [fundSearch,setFundSearch]=useState("");
  const load=async(month=data?.requestedMonth??"latest")=>{
    setRequestedMonth(month);setLoading(true);setError("");
    try{const r=await fetch("/api/portfolio?month="+encodeURIComponent(month),{cache:"no-store"});if(r.status===401){window.location.replace("/");return;}const p=await r.json() as MonthlyPortfolio&{error?:string};if(!r.ok)throw new Error(p.error||"Unable to load holdings.");setData({...p,funds:p.funds.map(f=>({...f,name:schemeNames[f.id]??f.name}))});setRequestedMonth(p.requestedMonth);}catch(e){setRequestedMonth(data?.requestedMonth??"latest");setError(e instanceof Error?e.message:"Unable to load holdings.");}finally{setLoading(false);}
  };
  useEffect(()=>{if(window.location.hash==="#investors")setSection("investors");void load();},[]);
  if(!data)return <main className="state"><h1>Equity funds</h1>{loading?<p className="loading-status" role="status"><span className="loading-spinner" aria-hidden="true"/>Loading your funds…</p>:<><p role="alert">{error}</p><button className="button" onClick={()=>void load()}>Try again</button></>}</main>;
  const months=[...new Set([data.calendarMonth,previousMonth(data.calendarMonth),...data.availableMonths])].sort().reverse();
  const shared=sharedCompanyHoldings(data);
  return <div className="dashboard"><WorkspaceHeader section={section} onNavigate={setSection}/><main className="fund-main">{section==="investors"?<AceInvestors/>:<>
    <div className="heading overview-heading"><div className="overview-copy"><h1>Equity funds</h1><p>20 small-cap funds and 4 additional Helios equity funds</p></div><div className="fund-actionbar"><label className="month-control"><span>Reporting month</span><span className="month-select-shell"><select aria-label="Reporting month" value={requestedMonth} disabled={loading} onChange={e=>void load(e.target.value)}>{months.map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}</select><ChevronDown size={18} aria-hidden="true"/></span></label><AgentResearch/><button className="reload-button" aria-label="Refresh fund holdings" title="Refresh fund holdings" disabled={loading} onClick={()=>void load()}><RotateCw size={18} className={loading?"refresh-spinning":undefined} aria-hidden="true"/><span>Refresh</span></button></div></div>
    <div className="results-region" aria-busy={loading}>{loading&&<div className="results-loader" role="status"><span className="loading-spinner" aria-hidden="true"/><span>Loading {monthLabel(requestedMonth)} holdings…</span></div>}<div className={loading?"results-content is-loading":"results-content"}>
    {error&&<p className="error-notice" role="alert">{error} Showing the last loaded comparison.</p>}
    <CombinedAnalysis key={data.requestedMonth} comparisons={data.fullComparisons??[]} month={data.requestedMonth}/>

    <details className="portfolio-section" open><summary className="portfolio-summary"><span>Fund portfolios</span><span className="section-toggle" aria-hidden="true"/></summary><div className="portfolio-content"><FundBrowser key={data.requestedMonth} data={data} view="table" search={fundSearch} onSearchChange={setFundSearch}/><div className="check-line"><span>Last saved check {time(data.checkedAt)}</span><span>{data.schedule.enabled?"Daily checks at 8 AM IST":"Daily updates not enabled"}</span></div>
    <p className="footnote">Monthly disclosure snapshots. Matching providers may share a data feed; holdings alone do not establish fund research quality.</p>
</div></details>
    <SharedHoldings companies={shared.companies} month={monthLabel(data.requestedMonth)} pending={data.funds.length===0} fullFunds={shared.fullFunds} topOnlyFunds={shared.topOnlyFunds} totalFunds={shared.totalFunds} missingFunds={data.missingFunds.length}/>
    </div></div></>}</main></div>;
}
