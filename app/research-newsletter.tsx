import type {ResearchReport} from "../lib/agent-research";
import {monthLabel} from "./research-overview";
export default function ResearchNewsletter({report}:{report:ResearchReport}){
 const letter=report.newsletter;
 if(!letter)return null;
 const latest=report.periods.find(p=>p.month===report.fundMonth);
 return <div className="research-newsletter">
  <div className="newsletter-edition"><span>THE OBSERVATORY LETTER</span><time dateTime={report.asOf}>{letter.edition}</time></div>
  <p className="newsletter-deck">{report.summary}</p>
  <div className="newsletter-pulse" aria-label="Portfolio coverage"><div><strong>{latest?.coverage??0}</strong><span>funds compared</span></div><div><strong>{latest?.companies??0}</strong><span>company records</span></div><div><strong>{latest?.mixed??0}</strong><span>mixed signals</span></div><div><strong>{monthLabel(report.fundMonth)}</strong><span>portfolio month</span></div></div>
  <p className="newsletter-scope">{report.coverageNote}</p>
  <nav className="newsletter-contents" aria-label="Newsletter contents"><a href="#newsletter-letter">Editor’s letter</a><a href="#newsletter-dispatches">In this issue</a><a href="#newsletter-watchlist">What to watch</a><a href="#top-ten-title">Company dossiers</a></nav>
  <section id="newsletter-letter" className="newsletter-letter"><span className="newsletter-kicker">FROM THE EDITOR</span><h2>Conviction needs more than a fund purchase</h2>{letter.editorNote.split("\n\n").map((p,i)=><p key={i}>{p}</p>)}</section>
  <div id="newsletter-dispatches">{letter.stories.map((s,i)=><article className="newsletter-story" key={s.title}><div className="newsletter-story-index">{String(i+1).padStart(2,"0")}</div><div><span className="newsletter-kicker">{s.label}</span><h2>{s.title}</h2>{s.paragraphs.map((p,j)=><p key={j}>{p}</p>)}{s.refs.length>0&&<div className="newsletter-sources">Sources: {s.refs.map(ref=>report.marketSources[ref]?<a key={ref} href={report.marketSources[ref].url} target="_blank" rel="noopener noreferrer">{report.marketSources[ref].label}</a>:null)}</div>}</div></article>)}</div>
  <section id="newsletter-watchlist" className="newsletter-watchlist"><span className="newsletter-kicker">THE NEXT CHECKPOINTS</span><h2>What to watch from here</h2><div>{letter.watchlist.map(w=><article key={w.title}><h3>{w.title}</h3><p>{w.text}</p></article>)}</div><p className="newsletter-signoff">{letter.closing}</p></section>
 </div>;
}
