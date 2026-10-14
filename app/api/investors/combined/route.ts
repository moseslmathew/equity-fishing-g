import {readerAllowed,deny} from "../../../../lib/access";
import {database,ensureDatabase,readInvestorCards} from "../../../../lib/database-store";
import {aceCombinedAnalysis} from "../../../../lib/ace-combined-analysis";
import type {InvestorPortfolio} from "../../../../lib/ace-investor-view";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!await readerAllowed(request.headers))return deny();
 try{
  await ensureDatabase();
  const [cards,rows]=await Promise.all([readInvestorCards(),database().prepare("SELECT investor_id,payload FROM investor_portfolios ORDER BY investor_id,checked_at DESC").all<{investor_id:string;payload:string}>()]);
  const latest=new Map<string,InvestorPortfolio>();
  for(const r of rows.results)if(!latest.has(r.investor_id))latest.set(r.investor_id,JSON.parse(r.payload));
  if(cards.some((c:any)=>!latest.has(c.id)))throw new Error("Incomplete investor coverage.");
  return Response.json(aceCombinedAnalysis(cards.map((c:any)=>({id:c.id,name:c.name,portfolio:latest.get(c.id)!}))),{headers:{"Cache-Control":"private, no-store"}});
 }catch{
  return Response.json({error:"Combined investor analysis could not be loaded. Please retry."},{status:503});
 }
}
