import {AlertTriangle,CheckCircle2,Info} from "lucide-react";
import type {ResearchReport} from "../lib/agent-research";
import type {ForensicStoryEnhancement} from "../lib/forensic-analysis";
import type {NewsletterStory} from "../lib/monthly-letter";
import {monthLabel} from "./research-overview";

function ConfidenceIcon({level}:{level:ForensicStoryEnhancement["confidence"]}){
 if(level==="High")return <CheckCircle2 size={14} aria-hidden="true"/>;
 if(level==="Cautionary")return <AlertTriangle size={14} aria-hidden="true"/>;
 return <Info size={14} aria-hidden="true"/>;
}

function ForensicEvidenceBlock({forensic}:{forensic:ForensicStoryEnhancement}){
 const toneClass=forensic.confidence==="High"?"is-high":forensic.confidence==="Cautionary"?"is-caution":"is-moderate";
 return <div className="forensic-block">
  <div className="forensic-meta-bar">
   <span className={"forensic-confidence "+toneClass}><ConfidenceIcon level={forensic.confidence}/><span>Confidence: {forensic.confidence}</span></span>
   <span className="forensic-timestamp">Data updated {forensic.asOf}</span>
  </div>
  {forensic.rows.length>0&&<div className="forensic-table-wrap">
   <table className="forensic-table">
    <thead>
     <tr>
      {forensic.columns.map(col=><th scope="col" key={col}>{col}</th>)}
     </tr>
    </thead>
    <tbody>
     {forensic.rows.map(row=><tr key={row.entity}>
      <td data-label={forensic.columns[0]}>
       {row.symbol?<a className="forensic-company-link" href={"/companies/"+encodeURIComponent(row.symbol)}>{row.entity}</a>:<span className="forensic-company-name">{row.entity}</span>}
      </td>
      <td data-label={forensic.columns[1]}>{row.trajectory}</td>
      <td data-label={forensic.columns[2]} className={"forensic-tone-"+row.tone}>{row.hiddenMetric}</td>
      <td data-label={forensic.columns[3]}>{row.crossSignal}</td>
     </tr>)}
    </tbody>
   </table>
  </div>}
  <details className="forensic-assumptions">
   <summary>Assumptions &amp; confidence basis</summary>
   <p><strong>Confidence basis:</strong> {forensic.confidenceReason}</p>
   <p><strong>Key assumptions:</strong> {forensic.assumptions}</p>
  </details>
 </div>;
}

export default function ResearchNewsletter({report}:{report:ResearchReport}){
 const letter=report.newsletter;
 if(!letter)return null;
 const latest=report.periods.find(p=>p.month===report.fundMonth);
 const stories=letter.stories as NewsletterStory[];
 return <div className="research-newsletter">
  <div className="newsletter-edition"><span>THE OBSERVATORY LETTER</span><time dateTime={report.asOf}>{letter.edition}</time></div>
  <p className="newsletter-deck">{report.summary}</p>
  <div className="newsletter-pulse" aria-label="Portfolio coverage"><div><strong>{latest?.coverage??0}</strong><span>funds compared</span></div><div><strong>{latest?.companies??0}</strong><span>company records</span></div><div><strong>{latest?.mixed??0}</strong><span>mixed signals</span></div><div><strong>{monthLabel(report.fundMonth)}</strong><span>portfolio month</span></div></div>
  <p className="newsletter-scope">{report.coverageNote}</p>
  <nav className="newsletter-contents" aria-label="Newsletter contents"><a href="#newsletter-letter">Methodological brief</a><a href="#newsletter-dispatches">Forensic findings</a><a href="#newsletter-watchlist">Verification checkpoints</a></nav>
  <section id="newsletter-letter" className="newsletter-letter"><span className="newsletter-kicker">FROM THE RESEARCH DESK</span><h2>Beyond headline holder counts: uncovering hidden capital flows</h2>{letter.editorNote.split("\n\n").map((p,i)=><p key={i}>{p}</p>)}</section>
  <div id="newsletter-dispatches">{stories.map((s,i)=><article className="newsletter-story" key={s.title}><div className="newsletter-story-index">{String(i+1).padStart(2,"0")}</div><div><span className="newsletter-kicker">{s.label}</span><h2>{s.title}</h2>{s.paragraphs.map((p,j)=><p key={j}>{p}</p>)}{s.forensic&&<ForensicEvidenceBlock forensic={s.forensic}/>}{s.refs.length>0&&<div className="newsletter-sources">Sources: {s.refs.map(ref=>report.marketSources[ref]?<a key={ref} href={report.marketSources[ref].url} target="_blank" rel="noopener noreferrer">{report.marketSources[ref].label}</a>:null)}</div>}</div></article>)}</div>
  <section id="newsletter-watchlist" className="newsletter-watchlist"><span className="newsletter-kicker">THE NEXT CHECKPOINTS</span><h2>What to monitor from here</h2><div>{letter.watchlist.map(w=><article key={w.title}><h3>{w.title}</h3><p>{w.text}</p></article>)}</div><p className="newsletter-signoff">{letter.closing}</p></section>
 </div>;
}
