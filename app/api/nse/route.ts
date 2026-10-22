import {readerAllowed,deny} from "../../../lib/access";
import {nseCandidates,nseSnapshot,validNseSymbol,nseFailure} from "../../../lib/nse-mcp";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function GET(request:Request){
  if(!await readerAllowed(request.headers))return deny();
  const params=new URL(request.url).searchParams,symbol=params.get("symbol"),query=params.get("query")?.trim();
  if(symbol!==null&&!validNseSymbol(symbol))return Response.json({error:"Enter a valid NSE equity symbol."},{status:400,headers});
  if(symbol===null&&(!query||query.length<2||query.length>100||/[\u0000-\u001f]/.test(query)))return Response.json({error:"Search using 2–100 characters."},{status:400,headers});
  try{
    if(symbol!==null){const snapshot=await nseSnapshot(symbol);return Response.json(snapshot,{status:snapshot.live||snapshot.eod?200:503,headers});}
    return Response.json({candidates:await nseCandidates(query!),retrievedAt:new Date().toISOString()},{headers});
  }catch(error){return Response.json({error:nseFailure(error)+" Your saved portfolios are unaffected."},{status:503,headers});}
}
