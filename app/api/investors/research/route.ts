import {readerAllowed,deny} from "../../../../lib/access";
import {database,ensureDatabase,readInvestorCards} from "../../../../lib/database-store";
import seed from "../../../../data/ace-investor-research.json";
import {enrichAceResearch} from "../../../../lib/ace-research";
import type {InvestorPortfolio} from "../../../../lib/ace-investor-view";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!await readerAllowed(request.headers))return deny();
 try{
  await ensureDatabase();const db=database();
  // A separate report scope preserves the existing mutual-fund research and migration history.
  await db.prepare("INSERT INTO research_reports (id,checked_at,model,fingerprint,payload) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(seed.id,seed.checkedAt,seed.modelName,seed.portfolioFingerprint,JSON.stringify(seed)).run();
  const [saved,cards,rows]=await Promise.all([db.prepare("SELECT payload FROM research_reports WHERE id LIKE 'ace-%' ORDER BY checked_at DESC LIMIT 1").first<{payload:string}>(),readInvestorCards(),db.prepare("SELECT investor_id,payload FROM investor_portfolios ORDER BY investor_id,checked_at DESC").all<{investor_id:string;payload:string}>()]);
  if(!saved)throw new Error("Report missing");const latest=new Map<string,InvestorPortfolio>();for(const r of rows.results)if(!latest.has(r.investor_id))latest.set(r.investor_id,JSON.parse(r.payload));if(cards.some((c: any)=>!latest.has(c.id)))throw new Error("Incomplete coverage");
  return Response.json(await enrichAceResearch(JSON.parse(saved.payload),cards.map((c: any)=>({id:c.id,name:c.name,portfolio:latest.get(c.id)!}))),{headers:{"Cache-Control":"private, no-store"}});
 }catch{return Response.json({error:"Ace investor research could not be loaded. Please retry."},{status:503});}
}
