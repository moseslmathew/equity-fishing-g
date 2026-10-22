import type {VolumeDay} from "./nse-volume";
export type VolumeView="daily"|"weekly"|"monthly";
export type VolumeBucket={key:string;label:string;from:string;to:string;sessions:number;volume:number;delivery:number|null;deliveryPercent:number|null;partial:boolean;incomplete:boolean};
const day=(date:string)=>new Date(date+"T00:00:00Z").toLocaleDateString("en-IN",{day:"numeric",month:"short",timeZone:"UTC"});
function week(date:string){const d=new Date(date+"T00:00:00Z");d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);}
function endOfWeek(date:string){const d=new Date(date+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+6);return d.toISOString().slice(0,10);}
export function volumeBuckets(rows:VolumeDay[],view:VolumeView,failedDates:string[],today:string):VolumeBucket[]{
 const groups=new Map<string,VolumeDay[]>();
 for(const row of [...new Map(rows.map(row=>[row.date,row])).values()].sort((a,b)=>a.date.localeCompare(b.date))){const key=view==="daily"?row.date:view==="weekly"?week(row.date):row.date.slice(0,7);groups.set(key,[...(groups.get(key)??[]),row]);}
 return [...groups.entries()].slice(-5).map(([key,items])=>{
 const volume=items.reduce((n,r)=>n+r.volume,0),delivery=items.every(r=>r.delivery!==null)?items.reduce((n,r)=>n+r.delivery!,0):null;
 const start=view==="monthly"?key+"-01":key,end=view==="monthly"?new Date(Date.UTC(Number(key.slice(0,4)),Number(key.slice(5,7)),0)).toISOString().slice(0,10):view==="weekly"?endOfWeek(key):key;
 const incomplete=failedDates.some(date=>date>=start&&date<=end);
 return {key,label:view==="monthly"?new Date(key+"-01T00:00:00Z").toLocaleDateString("en-IN",{month:"short",timeZone:"UTC"}):day(key),from:items[0].date,to:items.at(-1)!.date,sessions:items.length,volume,delivery,deliveryPercent:delivery!==null&&volume?delivery/volume*100:null,partial:view==="monthly"?key===today.slice(0,7):view==="weekly"?key===week(today):false,incomplete};
 });
}
export function bucketInsights(buckets:VolumeBucket[],view:VolumeView){
 if(buckets.some(b=>b.incomplete))return ["Some NSE reports are unavailable. Insights are withheld until these periods can be checked in full."];
 const latest=buckets.at(-1);if(!latest)return [];
 const prior=buckets.slice(0,-1).filter(b=>!b.partial),insights:string[]=[];
 const noun=view==="monthly"?"month":view==="weekly"?"week":"session";
 if(latest.partial)insights.push(`The latest ${noun} is still in progress (${latest.sessions} completed ${latest.sessions===1?"session":"sessions"}). Its volume is not compared with full periods.`);
 if(prior.length&&latest.deliveryPercent!==null){const valid=prior.filter(b=>b.deliveryPercent!==null);if(valid.length){const volume=valid.reduce((n,b)=>n+b.volume,0),delivered=valid.reduce((n,b)=>n+b.delivery!,0),baseline=volume?delivered/volume*100:null;
 if(baseline!==null){const delta=latest.deliveryPercent-baseline;insights.push(`Latest delivery share is ${latest.deliveryPercent.toFixed(2)}%, ${Math.abs(delta).toFixed(2)} percentage points ${delta>=0?"above":"below"} the preceding ${valid.length} ${noun}${valid.length>1?"s":""} combined.`);}
 const shares=valid.map(b=>b.deliveryPercent!);if(valid.length>=2&&latest.deliveryPercent>Math.max(...shares))insights.push(`Delivery share is the highest across the ${valid.length+1} displayed periods${latest.partial?" so far":""}.`);else if(valid.length>=2&&latest.deliveryPercent<Math.min(...shares))insights.push(`Delivery share is the lowest across the ${valid.length+1} displayed periods${latest.partial?" so far":""}.`);
 }}
 const completed=buckets.filter(b=>!b.partial);if(completed.length>=2){const last=completed.at(-1)!,previous=completed.at(-2)!;if(previous.volume>0){const delta=(last.volume/last.sessions/(previous.volume/previous.sessions)-1)*100;insights.push(`Average daily volume in the latest completed ${noun} was ${Math.abs(delta).toFixed(1)}% ${delta>=0?"higher":"lower"} than the previous one.`);}}
 const lastThree=buckets.slice(-3);if(lastThree.length===3&&lastThree.every(b=>b.deliveryPercent!==null)&&lastThree[2].deliveryPercent!>lastThree[1].deliveryPercent!&&lastThree[1].deliveryPercent!>lastThree[0].deliveryPercent!)insights.push("Delivery share has risen across the last three displayed periods.");
 if(!insights.length)insights.push("More comparable completed periods are needed to describe the trend.");
 return insights;
}
