import {readCurrentPortfolio,savePortfolio} from "../../../lib/database-store";
import { env } from "cloudflare:workers";
import expansion from "../../../data/fund-expansion-2026-10.json";
import seed from "../../../data/seed.json";
import { changesBetween, validatePortfolio, type Portfolio } from "../../../lib/portfolio";
import {readerAllowed,writerAllowed,deny} from "../../../lib/access";
import {archivePortfolio,monthlyPortfolio,validMonth} from "../../../lib/monthly";
import {readFullComparisons} from "../../../lib/full-portfolio-store";
import {withTopHoldings} from "../../../lib/top-holdings";
export const dynamic = "force-dynamic";
const key = "portfolio/current.json";
const headers = { "Cache-Control": "no-store" };
// Add newly selected schemes without replacing any existing saved fund history.
function expandedSnapshot(current:Portfolio):Portfolio {
  const baseline={...seed,funds:[...seed.funds,...expansion.funds.filter(f=>f.portfolioDate==="2026-09-30")]} as Portfolio,added=baseline.funds.some(base=>!current.funds.some(f=>f.id===base.id));
  return {...current,
    checkedAt:added?[current.checkedAt,...baseline.funds.filter(base=>!current.funds.some(f=>f.id===base.id)).map(f=>f.lastCheckedAt)].sort().at(-1)!:current.checkedAt,
    summary:added?baseline.summary:current.summary,
    runs:added?[baseline.runs[0],...current.runs].filter((run,i,all)=>all.findIndex(other=>other.at===run.at)===i).slice(0,60):current.runs,
    funds:baseline.funds.map(base=>current.funds.find(f=>f.id===base.id)??base)};
}
async function expandedReadSnapshot(b:R2Bucket,current:Portfolio){
  const snapshot=expandedSnapshot(current);
  const comparisons=(await Promise.all([...new Set(snapshot.funds.map(f=>f.portfolioDate.slice(0,7)))].map(month=>readFullComparisons(b,month)))).flat();
  return {...snapshot,funds:snapshot.funds.map(f=>withTopHoldings(f,comparisons.find(c=>c.fundId===f.id&&c.currentDate===f.portfolioDate)))};
}
async function bucket() {
  const b = (env as Cloudflare.Env).BUCKET;
  if (!b) throw new Error("Portfolio storage is unavailable.");
  return b;
}
export async function GET(request:Request) {
  if(!await readerAllowed(request.headers))return deny();
  const month=new URL(request.url).searchParams.get("month");
  if(month&&month!=="latest"&&!validMonth(month))return Response.json({error:"Choose a reporting month in YYYY-MM format."},{status:400,headers});
  try {
    const b=await bucket();
    const snapshot=expandedSnapshot(await readCurrentPortfolio());
    return Response.json(month?await monthlyPortfolio(b,snapshot,seed as Portfolio,month):await expandedReadSnapshot(b,snapshot),{headers});
  } catch (e) {
    console.error("Portfolio read failed", e instanceof Error ? e.message : "unknown");
    return Response.json({error:"Portfolio data is temporarily unavailable. Please try again."},{status:503,headers});
  }
}
export async function POST(request: Request) {
  // Independent updater authorization is required regardless of Site audience.
  // Password sessions allow read access only.
  if(!await writerAllowed(request.headers))return deny();
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({error:"Expected JSON."},{status:415});
  if (Number(request.headers.get("content-length")||0)>250000) return Response.json({error:"Snapshot too large."},{status:413});
  let input: {snapshot: Portfolio; kind?: string};
  try {
    const raw = await request.text();
    if (raw.length>250000) return Response.json({error:"Snapshot too large."},{status:413});
    input = JSON.parse(raw);
    validatePortfolio(input.snapshot);
  } catch (e) {
    return Response.json({error:e instanceof Error ? e.message : "Invalid payload."},{status:400});
  }
  try {
    const b = await bucket();
    const previous = await expandedReadSnapshot(b,await readCurrentPortfolio());
    if (previous && Date.parse(input.snapshot.checkedAt)<Date.parse(previous.checkedAt)) return Response.json({error:"An older check cannot replace the current snapshot."},{status:409});
    if (previous) for (const f of input.snapshot.funds) {
      const old = previous.funds.find(x=>x.id===f.id)!;
      if (f.portfolioDate<old.portfolioDate) return Response.json({error:"An older portfolio cannot replace verified holdings."},{status:409});
      if (f.checkStatus==="failed" || f.checkStatus==="conflict") {
        f.holdings=old.holdings; f.portfolioDate=old.portfolioDate;
      }
    }
    const snapshot = input.snapshot;
    snapshot.updatedAt = new Date().toISOString();
    const changes = previous ? changesBetween(previous,snapshot) : [];
    snapshot.runs = input.kind === "settings" && previous ? previous.runs : [{at:snapshot.checkedAt, summary:snapshot.summary, changes, status:previous ? "check" : "initial"},...(previous?.runs ?? [])].slice(0,60);
    // Keep reporting months before advancing the latest snapshot.
    await archivePortfolio(b,previous??seed as Portfolio);
    await archivePortfolio(b,snapshot);
    await savePortfolio(snapshot,previous??seed as Portfolio);
    return Response.json({ok:true,updatedAt:snapshot.updatedAt,changes:changes.length},{headers});
  } catch (e) {
    console.error("Portfolio write failed",e instanceof Error ? e.message : "unknown");
    return Response.json({error:"The update could not be saved. The previous snapshot remains available."},{status:503,headers});
  }
}
