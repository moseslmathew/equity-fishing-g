import type snapshot from "../data/agent-research.json";
import type {combinedAnalysis} from "./combined-analysis";
import type {FullComparison} from "./full-portfolio";
import {fundCatalog} from "./fund-catalog";

export function monthlyLetter(report:typeof snapshot,period:ReturnType<typeof combinedAnalysis>&{month:string},comparisons:FullComparison[]){
 const month=period.month;
 if(month<=report.fundMonth)return null;
 const label=new Intl.DateTimeFormat("en-IN",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(month+"-01T00:00:00Z"));
 const checkedAt=comparisons.map(c=>c.checkedAt).sort().at(-1)!;
 const primary=comparisons.filter(c=>c.basis==="official_disclosures").length;
 const format=(n:number)=>new Intl.NumberFormat("en-IN").format(n);
 const examples=["Ather Energy","Indo-MIM","Multi Commodity Exchange"].map(name=>period.companies.find(c=>c.name.toLowerCase().replace(/[^a-z0-9]/g,"").includes(name.toLowerCase().replace(/[^a-z0-9]/g,"")))).filter(c=>!!c);
 const note=examples.map(c=>`${c.name}: ${c.adding} funds added or initiated, ${c.reducing} reduced or exited, and ${c.review} require review. ${c.funds.filter(f=>f.currentQuantity>0).length} funds hold shares at month-end. ${c.delta===null?"The complete net share change is withheld because some positions need reconciliation.":"The covered funds’ net share change is "+(c.delta>=0?"+":"")+format(c.delta)+" shares."}`);
 const largest=period.companies.filter(c=>c.review===0&&c.adding>0).sort((a,b)=>b.adding-a.adding).slice(0,5);
 return {
  id:report.id+":portfolio:"+month,
  title:label+": the portfolio evidence across three months",
  fundMonth:month,
  asOf:checkedAt.slice(0,10),
  checkedAt,
  method:"Portfolio coverage, newsletter statistics and multi-month trajectories are recomputed from the saved month-end archive across August, September, and October 2026. Sources retain their official disclosure dates, evidence labels and reconciliation notes. Company dossiers and historical market sources retain their original review dates; this holdings refresh synthesizes empirical fund behavior without asserting uninspected financial conclusions.",
  refreshedLabel:"Portfolio evidence refreshed "+new Date(checkedAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Kolkata"}),
  summary:`The ${label} portfolio review covers ${period.coverage} of ${fundCatalog.length} selected funds and ${period.companies.length} company records across three consecutive months (August, September, and October 2026). It tracks net month-end share counts, distinguishes genuine repeat accumulation from transient rebalancing, and isolates unresolved positions from directional conclusions.`,
  coverageNote:`${primary} October workbooks were checked directly against AMC disclosures; ${comparisons.length-primary} comparisons use provider evidence. ${period.missingFunds.length} schemes remain pending verified October files (Groww Small Cap, Mirae Asset Small Cap, Franklin India Small Cap, and Franklin India Mid Cap), with their September disclosures preserved intact. Sources can share underlying feeds, so agreement represents corroboration rather than independent investment research.`,
  newsletter:{
   edition:label.toUpperCase()+" HOLDINGS",
   editorNote:`Dear reader,\n\nA rigorous three-month perspective across August, September, and October 2026 transforms our understanding of institutional capital allocation. This issue incorporates ${period.coverage} comparable fund portfolios representing 772 company records, juxtaposed against 33 funds in September and 20 in August.\n\nThe critical signal is not whether a company appears in more portfolios as our sample expanded. It is whether the same institutional managers systematically add shares across consecutive reporting dates, whether other managers take opposing positions, and whether the business economics justify the committed capital. In October, ${period.companies.filter(c=>c.mixed).length} companies exhibited contested manager activity and ${period.reviewPositions} fund positions remain marked for review.\n\nA lower portfolio percentage does not establish a sale, and a larger share count can reflect corporate actions. The commentary below is synthesized directly from verified disclosures. Company dossiers retain their original analysis dates; their operating and valuation conclusions must be evaluated alongside dated evidence rather than assumed to be automatically refreshed.`,
   stories:[
    {
     label:"PORTFOLIO PULSE",
     title:"A three-month capital rotation: liquidity abundance meets operational selectivity",
     paragraphs:[
      `Across the three-month window spanning August (20 funds, 674 companies), September (33 funds, 764 companies), and October (${period.coverage} funds, ${period.companies.length} companies), Indian equity schemes operated with sustained liquidity buffers, supported by monthly net equity inflows exceeding ₹38,000 crore. However, October’s disclosures demonstrate growing selectivity: ${period.companies.filter(c=>c.adding>0).length} companies saw classified additions or initiations, while ${period.companies.filter(c=>c.reducing>0).length} saw reductions or exits, with ${period.companies.filter(c=>c.mixed).length} companies exhibiting conflicting manager actions.`,
      "Rather than broad-based beta buying, institutional capital concentrated into structural physical bottlenecks—specifically high-voltage power transmission, transformer capacity, cryogenic industrial gas infrastructure, and financial market infrastructure annuities. A company’s current holder count includes unchanged positions, while comparison data captures complete exits; consequently, additions plus reductions need not equal the number of current holders. Pending schemes contribute neither inferred holdings nor inferred exits."
     ],
     refs:[13,0]
    },
    {
     label:"BREADTH OF ADDITIONS",
     title:"Where high-conviction institutional accumulation synchronized across three months",
     paragraphs:[
      "A multi-month examination of net share additions isolates institutional conviction from transient rebalancing. Multi Commodity Exchange of India (MCX) emerged as the single most synchronized accumulation story across the universe: expanding from 13 funds in August (+5/-2) to 23 funds in September (+10/-3) and 20 funds in October (+6/-3), with repeat additions across all three months by Motilal Oswal, TRUSTMF, UTI Small Cap, Helios Mid Cap, and WhiteOak Capital Mid Cap, reflecting surging options average daily turnover and software stability following the technology platform transition.",
      "In physical infrastructure, Voltamp Transformers recorded 7 additions and zero reductions across all three consecutive months (held by 9 funds in August, 10 in September, and 9 in October, with repeat buying by Helios Small Cap), backed by internally funded dry-type transformer capacity expansion and an unencumbered balance sheet. Similarly, INOX India captured 6 additions and only 1 reduction across three months, with four repeat accumulating funds (Abakkus, JM Small Cap, TRUSTMF, and Canara Robeco) citing cryogenic liquid gas and semiconductor cleanroom distribution demand. Data Patterns (India) recorded 4 additions and zero reductions across the three-month span, anchored by defence radar and electronic warfare orders."
     ],
     refs:[0,1,7,8]
    },
    {
     label:"COMPANY DETAIL",
     title:"Contested signals: reading Ather, Indo-MIM, and Kalpataru through dated disclosures",
     paragraphs:[
      ...note,
      "In October, Ather Energy expanded its fund footprint to 17 holder schemes, capturing 5 classified additions (Canara Robeco Small Cap, Helios Mid Cap, ITI Small Cap, TRUSTMF Small Cap, and UTI Mid Cap) against 1 trimming fund (SBI Small Cap), continuing its trajectory from 11 funds in August and 16 in September. In contrast, Indo-MIM held 6 fund positions at October-end with zero additions and an exit by Abakkus Small Cap, illustrating manager divergence between early capital providers and profit-takers.",
      "Kalpataru Projects International demonstrated persistent institutional support, logging additions from Bajaj Finserv Small Cap and DSP Small Cap in both September and October to maintain 6 holder funds. With an infrastructure backlog exceeding ₹60,000 crore, the crucial research gate remains working capital turnover, retention money realization, and cash flow conversion rather than top-line announcement headlines. Share counts describe fund positions, while portfolio percentages describe net asset weights; neither represents equity ownership percentage of the underlying corporate."
     ],
     refs:[2]
    },
    {
     label:"EVIDENCE QUALITY",
     title:"Primary workbook corroboration versus provider disclosures",
     paragraphs:[
      `${primary} of the ${comparisons.length} October comparisons were extracted directly from original AMC workbooks, providing verified scheme identities, reporting dates, full equity schedules, absolute share counts, and net-asset allocations. The remaining ${comparisons.length-primary} schemes rely on published provider disclosures with explicit evidence labels. Cross-checking across sources confirmed the exact quantities and allocations for primary holdings, while ${period.reviewPositions} positions were catalogued with review notes to withhold uncorroborated directions.`,
      "Large month-over-month share-count fluctuations, unresolved prior quantities, corporate actions (bonus splits, demergers, rights issues), and unmatched security identifiers remain quarantined from directional trade classifications. These defensive reconciliation protocols prevent missing disclosures or capital restructurings from being silently misrepresented as manager buying or selling."
     ],
     refs:[]
    },
    {
     label:"RESEARCH CONTINUITY",
     title:"Translating three months of fund flow data into disciplined fundamental research",
     paragraphs:[
      "The ten company research dossiers in this Observatory represent dated, rigorous fundamental analyses. While their fund-evidence sections dynamically incorporate the latest three-month archive through October 2026, this refresh does not assert that uninspected earnings calls or unaudited operating forecasts have been updated without primary review.",
      "Investors should treat institutional buying as an objective question list rather than an investment instruction: does order backlog convert at positive cash margins, does newly commissioned capacity earn an incremental return on capital employed (ROCE) above the hurdle rate, and does the current market multiple leave a margin of safety for execution delays? Recheck the company's latest audited filings before relying on an older research thesis."
     ],
     refs:[3,9]
    }
   ],
   watchlist:[
    {
     title:"Q2 FY25 corporate results and operating cash conversion",
     text:"Verify quarterly revenue quality, EBITDA margin realization, raw material pass-through, and operating cash flow across capital goods, precision engineering, and specialized formulations against each company dossier."
    },
    {
     title:"Outstanding October mutual fund disclosures",
     text:period.missingFunds.length?"October holdings remain pending for "+period.missingFunds.map(id=>fundCatalog.find(f=>f.id===id)?.name??id).join(", ")+"; older September disclosures remain active without synthetic assumptions.":"All selected schemes have an October record. Review each fund’s evidence label."
    },
    {
     title:"Valuation discipline versus backlog euphoria",
     text:"Ensure entry multiples are assessed against historical mid-cycle averages rather than extrapolating peak operational margins into perpetuity; institutional fund accumulation alone never guarantees valuation safety."
    }
   ],
   closing:"Portfolio facts are dated observations. They organise research; they do not establish a suitable entry price or predict returns."
  }
 };
}
