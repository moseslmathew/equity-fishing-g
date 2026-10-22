export type VolumeDay={date:string;volume:number;delivery:number|null;source:string};
export type VolumePeriod={sessions:number;from:string;to:string;volume:number;average:number;delivery:number|null;deliveryPercent:number|null};
export type VolumeReport={symbol:string;series:string;retrievedAt:string;rows:VolumeDay[];periods:{daily:VolumePeriod|null;weekly:VolumePeriod|null;monthly:VolumePeriod|null};insights:string[];failedDates:string[];failureReasons?:Record<string,string>};
const archiveRoot="https://nsearchives.nseindia.com/products/content/";
export function archiveUrl(date:string){return archiveRoot+"sec_bhavdata_full_"+date.slice(8,10)+date.slice(5,7)+date.slice(0,4)+".csv";}
const numeric=(s:string|undefined)=>s!==undefined&&s.trim()!==""&&s.trim()!=="-"&&Number.isFinite(Number(s))&&Number(s)>=0?Number(s):null;
export function parseVolumeLine(header:string,line:string,symbol:string,series:string,date:string):VolumeDay|null{
 const columns=header.split(",").map(s=>s.trim()),values=line.split(",").map(s=>s.trim()),get=(key:string)=>values[columns.indexOf(key)];
 if(get("SYMBOL")!==symbol||get("SERIES")!==series)return null;
 const stamp=get("DATE1")?.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/),months=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
 const month=stamp?months.indexOf(stamp[2].toLowerCase()):-1;
 const reportedDate=stamp&&month>=0?stamp[3]+"-"+String(month+1).padStart(2,"0")+"-"+stamp[1].padStart(2,"0"):"";
 // Holiday URLs can return a prior session's report. Use the date in the row,
 // then deduplicate it; never count the holiday as an extra trading session.
 if(!reportedDate||reportedDate>date||Date.parse(date)-Date.parse(reportedDate)>7*86400000)throw new Error("NSE report date does not match.");
 const volume=numeric(get("TTL_TRD_QNTY")),delivery=numeric(get("DELIV_QTY"));
 if(volume===null||!Number.isSafeInteger(volume)||delivery!==null&&(!Number.isSafeInteger(delivery)||delivery>volume))throw new Error("Invalid NSE volume data.");
 return {date:reportedDate,volume,delivery,source:archiveUrl(date)};
}
export function summarizeVolume(rows:VolumeDay[],sessions:number):VolumePeriod|null{
 if(rows.length<sessions)return null;
 const chosen=rows.slice(0,sessions),volume=chosen.reduce((sum,r)=>sum+r.volume,0),delivery=chosen.every(r=>r.delivery!==null)?chosen.reduce((sum,r)=>sum+r.delivery!,0):null;
 return {sessions,from:chosen.at(-1)!.date,to:chosen[0].date,volume,average:volume/sessions,delivery,deliveryPercent:delivery!==null&&volume>0?delivery/volume*100:null};
}
export function volumeInsights(rows:VolumeDay[],failedDates:string[]=[]){
 if(rows.length<21)return ["More completed sessions are needed for a reliable volume comparison."];
 const latest=rows[0],prior=summarizeVolume(rows.slice(1),20)!;
 if(failedDates.some(date=>date>=rows[Math.min(24,rows.length-1)].date))return ["Some NSE reports could not be checked. Trend insights are withheld until the history is complete."];
 const insights:string[]=[];
 if(prior.average>0){const ratio=latest.volume/prior.average;insights.push(`Latest volume was ${ratio.toFixed(2)}× the previous 20-session daily average — ${ratio>=1.5?"unusually active":ratio<0.7?"quieter trading":"within the usual activity range"}.`);}
 if(rows.length>=25){const recent=summarizeVolume(rows,5)!,baseline=summarizeVolume(rows.slice(5),20)!;if(baseline.average>0){const delta=(recent.average/baseline.average-1)*100;insights.push(`The 5-session daily average is ${Math.abs(delta).toFixed(1)}% ${delta>=0?"above":"below"} the preceding 20-session average.`);}}
 if(latest.delivery!==null&&latest.volume>0&&prior.deliveryPercent!==null){const pct=latest.delivery/latest.volume*100,difference=pct-prior.deliveryPercent;insights.push(`Delivery participation was ${pct.toFixed(1)}%, ${Math.abs(difference).toFixed(1)} percentage points ${difference>=0?"above":"below"} its previous 20-session level. This does not identify who bought or sold.`);}
 return insights;
}
async function readArchive(symbol:string,series:string,date:string,signal:AbortSignal):Promise<VolumeDay|null>{
 const response=await fetch(archiveUrl(date),{signal:AbortSignal.any([signal,AbortSignal.timeout(25_000)]),redirect:"manual"});
 if(response.status===404){await response.body?.cancel();return null;}
 if(!response.ok||!response.body)throw new Error("NSE archive returned HTTP "+response.status+".");
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="",header="",bytes=0;
 const line=(value:string)=>{if(!header){header=value.replace(/^\uFEFF/,"");if(!header.includes("DELIV_QTY")||!header.includes("TTL_TRD_QNTY"))throw new Error("Unexpected NSE report.");return null;}return value.startsWith(symbol+",")?parseVolumeLine(header,value,symbol,series,date):null;};
 try{while(true){const next=await reader.read();if(next.done)break;bytes+=next.value.length;if(bytes>4_000_000)throw new Error("NSE report too large.");buffer+=decoder.decode(next.value,{stream:true});let end:number;while((end=buffer.indexOf("\n"))!==-1){const row=line(buffer.slice(0,end).trim());buffer=buffer.slice(end+1);if(row)return row;}}return buffer?line(buffer.trim()):null;}
 finally{void reader.cancel().catch(()=>{});}
}
const cache=new Map<string,{until:number;value:VolumeReport}>();
const pending=new Map<string,Promise<VolumeReport>>();
export async function nseVolumeReport(symbol:string,series="EQ",now=new Date(),month?:string):Promise<VolumeReport>{
 const today=now.toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"}),key=symbol+":"+series+":"+(month??"recent")+":"+today,cached=cache.get(key);
 if(cached&&cached.until>Date.now())return cached.value;
 if(pending.has(key))return pending.get(key)!;
 const task=(async()=>{const dates:string[]=[],start=month?month+"-01":null;
 const monthEnd=month?new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10):today;
 const end=monthEnd<today?monthEnd:today;
 for(let i=0;i<(month?31:45);i++){const day=new Date(end+"T00:00:00Z");day.setUTCDate(day.getUTCDate()-i);const date=day.toISOString().slice(0,10);if(start&&date<start)break;if(day.getUTCDay()!==0&&day.getUTCDay()!==6)dates.push(date);}
 const rows:VolumeDay[]=[],failedDates:string[]=[],failureReasons:Record<string,string>={};let index=0;const deadline=AbortSignal.timeout(55_000);
 await Promise.all(Array.from({length:4},async()=>{while(index<dates.length){const date=dates[index++];try{const row=await readArchive(symbol,series,date,deadline);if(row&&(!start||row.date>=start)&&row.date<=end)rows.push(row);}catch(error){failedDates.push(date);failureReasons[date]=error instanceof Error?error.message:"NSE report unavailable";}}}));
 // Retry only failed archive reads once. Initial scan plus at most 12 retries
 // stays below the hosted request's subrequest limit and the overall deadline.
 const retryDates=failedDates.splice(0,12);for(const date of retryDates)delete failureReasons[date];
 await Promise.all(retryDates.map(async date=>{try{const row=await readArchive(symbol,series,date,deadline);if(row&&(!start||row.date>=start)&&row.date<=end)rows.push(row);}catch(error){failedDates.push(date);failureReasons[date]=error instanceof Error?error.message:"NSE report unavailable";}}));
 const unique=new Map<string,VolumeDay>();for(const row of rows){const existing=unique.get(row.date);if(existing&&(existing.volume!==row.volume||existing.delivery!==row.delivery))failedDates.push(row.date);else unique.set(row.date,row);}
 rows.splice(0,rows.length,...[...unique.values()].sort((a,b)=>b.date.localeCompare(a.date)));
 const safe=(n:number)=>{const period=summarizeVolume(rows,n);return period&&!failedDates.some(date=>date>=period.from)?period:null;};
 const value:VolumeReport={symbol,series,retrievedAt:new Date().toISOString(),rows,periods:{daily:safe(1),weekly:safe(5),monthly:safe(20)},insights:volumeInsights(rows,failedDates),failedDates,failureReasons};
 if(rows.length&&!failedDates.length){if(cache.size>50)cache.clear();cache.set(key,{until:Date.now()+600_000,value});}return value;
 })();pending.set(key,task);try{return await task;}finally{pending.delete(key);}
}
