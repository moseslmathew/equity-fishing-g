import type {ResearchReport} from "../lib/agent-research";
import ResearchNewsletter from "./research-newsletter";
import IntelligenceOverview,{IntelligenceMethod} from "./intelligence-overview";
export const monthLabel=(value:string)=>new Intl.DateTimeFormat("en-IN",{month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(value+"-01T00:00:00Z"));
export default function ResearchOverview({report}:{report:ResearchReport}){
 return <section className="research-editorial" aria-label="Comprehensive mutual fund research" data-report-section="comprehensive">
 {report.portfolioChanged&&<p className="research-coverage-warning" role="status">Portfolio records have changed since this report. Live evidence below is current to the saved archive; the narrative needs a new research review.</p>}
 {report.newsletter?<ResearchNewsletter report={report}/>:<IntelligenceOverview report={report.intelligence} sources={report.marketSources} summary={report.summary} coverageNote={report.coverageNote}/>}
 <IntelligenceMethod method={report.method} limitations={report.limitations} mediaNote={report.intelligence.mediaNote} modelName={report.modelName} modelDisclosure={report.modelDisclosure} sources={report.marketSources}/>
 </section>;
}
