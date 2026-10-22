import {readerAllowed,deny} from "../../../../lib/access";
import {nseSecurity} from "../../../../lib/nse-security-links";
import {nseVolumeReport} from "../../../../lib/nse-volume";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!await readerAllowed(request.headers))return deny();
 const params=new URL(request.url).searchParams,symbol=params.get("symbol")??"",series=params.get("series")??"EQ",month=params.get("month")??undefined;
 const headers={"Cache-Control":"private, no-store"};
 if(!nseSecurity(symbol)||!["EQ","BE","BZ","SM","ST"].includes(series))return Response.json({error:"Invalid NSE equity security."},{status:400,headers});
 if(month){const current=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"}).slice(0,7);const first=new Date(current+"-01T00:00:00Z");first.setUTCMonth(first.getUTCMonth()-5);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||month>current||month<first.toISOString().slice(0,7))return Response.json({error:"Choose one of the latest six months."},{status:400,headers});}
 try{const data=await nseVolumeReport(symbol,series,new Date(),month);return Response.json(data,{status:data.rows.length||data.failedDates.length===0?200:503,headers});}catch{return Response.json({error:"NSE volume reports are temporarily unavailable."},{status:503,headers});}
}
