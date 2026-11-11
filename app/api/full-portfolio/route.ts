import {saveComparison} from "../../../lib/database-store";
import {env} from "cloudflare:workers";
import {readerAllowed,writerAllowed,deny} from "../../../lib/access";
import {validMonth} from "../../../lib/monthly";
import {validateFullComparison,type FullComparison} from "../../../lib/full-portfolio";
import {readFullComparisons,fullKey} from "../../../lib/full-portfolio-store";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
function bucket(){return (env as Partial<Cloudflare.Env>)?.BUCKET;}
export async function GET(request:Request) {
  if(!await readerAllowed(request.headers))return deny();
  const month=new URL(request.url).searchParams.get("month");
  if(!month||!validMonth(month))return Response.json({error:"Choose a reporting month in YYYY-MM format."},{status:400,headers});
  try{return Response.json({month,comparisons:await readFullComparisons(bucket(),month)},{headers});}
  catch{return Response.json({error:"Full portfolio data is temporarily unavailable."},{status:503,headers});}
}
export async function POST(request:Request) {
  if(!await writerAllowed(request.headers))return deny();
  if(!request.headers.get("content-type")?.includes("application/json"))return Response.json({error:"Expected JSON."},{status:415});
  let c:FullComparison;
  try{const raw=await request.text();if(raw.length>500000)return Response.json({error:"Comparison too large."},{status:413});c=JSON.parse(raw).comparison;validateFullComparison(c);}
  catch(e){return Response.json({error:e instanceof Error?e.message:"Invalid comparison."},{status:400});}
  try{
    const b=bucket(),month=c.currentDate.slice(0,7);
    const existing=(await readFullComparisons(b,month)).find(x=>x.fundId===c.fundId);
    if(existing&&Date.parse(existing.checkedAt)>Date.parse(c.checkedAt))return Response.json({error:"An older comparison cannot replace the saved data."},{status:409});
    await saveComparison(c);
    return Response.json({ok:true,fundId:c.fundId,month},{headers});
  }catch{return Response.json({error:"The comparison could not be saved."},{status:503,headers});}
}
