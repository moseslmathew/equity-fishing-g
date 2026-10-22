import {archiveUrl,type VolumeDay,type VolumeReport} from "./nse-volume";
export function savedVolumeReport(value:unknown,symbol:string,series:string,month:string):VolumeReport|null{
 const shard=value as {version:number;month:string;checkedAt:string;securities:Record<string,unknown>};
 if(!shard||shard.version!==1||shard.month!==month||!Number.isFinite(Date.parse(shard.checkedAt))||!shard.securities)return null;
 const entries=shard.securities[symbol+":"+series];if(!Array.isArray(entries))return null;
 const rows:VolumeDay[]=[];
 for(const entry of entries){if(!Array.isArray(entry)||entry.length!==3)return null;const [date,volume,delivery]=entry;if(typeof date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date.slice(0,7)!==month||!Number.isSafeInteger(volume)||volume<0||delivery!==null&&(!Number.isSafeInteger(delivery)||delivery<0||delivery>volume))return null;rows.push({date,volume,delivery,source:archiveUrl(date)});}
 rows.sort((a,b)=>b.date.localeCompare(a.date));
 return {symbol,series,retrievedAt:shard.checkedAt,rows,periods:{daily:null,weekly:null,monthly:null},insights:[],failedDates:[]};
}
export function mergeVolumeReports(saved:VolumeReport|null,latest:VolumeReport):VolumeReport{
 if(!saved)return latest;
 if(saved.symbol!==latest.symbol||saved.series!==latest.series)throw new Error("Cannot merge different securities.");
 const rows=[...new Map([...saved.rows,...latest.rows].map(row=>[row.date,row])).values()].sort((a,b)=>b.date.localeCompare(a.date)),known=new Set(rows.map(row=>row.date));
 return {...latest,rows,failedDates:latest.failedDates.filter(date=>!known.has(date))};
}
