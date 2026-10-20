import {readerAllowed,deny} from "../../../lib/access";
import {readForeignResearch} from "../../../lib/foreign-investor-store";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!await readerAllowed(request.headers))return deny();
 try{const data=await readForeignResearch(new URL(request.url).searchParams.get("id")||"blackstone");return data?Response.json(data,{headers:{"Cache-Control":"private, no-store"}}):Response.json({error:"Foreign investor not found."},{status:404});}catch{return Response.json({error:"Foreign investor research is temporarily unavailable. Please retry."},{status:503});}
}
