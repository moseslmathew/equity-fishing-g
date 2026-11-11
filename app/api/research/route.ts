import researchSeed from "../../../data/agent-research.json";
import {validateReportShape} from "../../../lib/database-validation";
import {readResearchSnapshot,saveResearchSnapshot} from "../../../lib/database-store";
import {env} from "cloudflare:workers";
import {readerAllowed,writerAllowed,deny} from "../../../lib/access";
import {researchReport} from "../../../lib/agent-research";
import {readAllFullComparisons} from "../../../lib/full-portfolio-store";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  if(!await readerAllowed(request.headers))return deny();
  try {
    const bucket=(env as Partial<Cloudflare.Env>)?.BUCKET;
    return Response.json(researchReport(await readAllFullComparisons(bucket),await readResearchSnapshot()),{headers:{"Cache-Control":"no-store"}});
  }catch{return Response.json({error:"The complete research archive could not be loaded. Please retry."},{status:503,headers:{"Cache-Control":"no-store"}});}
}

export async function POST(request:Request){
 if(!await writerAllowed(request.headers))return deny();
 if(!request.headers.get("content-type")?.includes("application/json"))return Response.json({error:"Expected JSON."},{status:415});
 try{const raw=await request.text();if(raw.length>1000000)return Response.json({error:"Report too large."},{status:413});const value=JSON.parse(raw).report;validateReportShape(value,researchSeed);if(!Number.isFinite(Date.parse(value.checkedAt))||!value.id||value.stocks.length!==10)throw new Error("Invalid report metadata.");await saveResearchSnapshot(value);return Response.json({ok:true,id:value.id},{headers:{"Cache-Control":"no-store"}});}catch(e){return Response.json({error:e instanceof Error?e.message:"Report update failed."},{status:400});}
}
