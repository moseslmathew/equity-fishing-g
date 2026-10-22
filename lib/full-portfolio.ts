import {ids} from "./portfolio";
export type FullHolding={key:string;name:string;previousQuantity:number|null;currentQuantity:number;weight:number|null;previousWeight:number|null;note:string|null};
export type FullComparison={fundId:string;currentDate:string;previousDate:string;checkedAt:string;scope:"full_equity";basis:"provider_quantity_comparison"|"official_disclosures";rows:FullHolding[];sources:{label:string;url:string;scope:string}[];notes:string[]};
export type Movement="increased"|"decreased"|"new"|"exited"|"unchanged"|"review";
export function movement(row:FullHolding):Movement {
  if(row.note||row.previousQuantity===null)return "review";
  if(row.previousQuantity===0)return "new";
  if(row.currentQuantity===0)return "exited";
  return row.currentQuantity>row.previousQuantity?"increased":row.currentQuantity<row.previousQuantity?"decreased":"unchanged";
}
export function netQuantity(row:FullHolding) {return row.previousQuantity===null?null:row.currentQuantity-row.previousQuantity;}
export function comparisonCounts(c:FullComparison) {
  const counts={increased:0,decreased:0,new:0,exited:0,unchanged:0,review:0,current:0};
  for(const row of c.rows){counts[movement(row)]++;if(row.currentQuantity>0)counts.current++;}
  return counts;
}
export function validateFullComparison(value:unknown):asserts value is FullComparison {
  const c=value as FullComparison;
  const validDate=(s:string)=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
  if(!c||!ids.includes(c.fundId)||!validDate(c.currentDate)||!validDate(c.previousDate)||!Number.isFinite(Date.parse(c.checkedAt))||c.scope!=="full_equity"||!["provider_quantity_comparison","official_disclosures"].includes(c.basis))throw new Error("Invalid full-portfolio metadata.");
  const [y,m]=c.currentDate.slice(0,7).split("-").map(Number);
  if(c.previousDate.slice(0,7)!==new Date(Date.UTC(y,m-2,1)).toISOString().slice(0,7)||c.currentDate>new Date().toISOString().slice(0,10))throw new Error("Use two adjacent completed reporting months.");
  if(!Array.isArray(c.rows)||c.rows.length===0||c.rows.length>600||!Array.isArray(c.sources)||c.sources.length<2||!Array.isArray(c.notes)||c.notes.some(n=>typeof n!=="string"))throw new Error("Full company holdings and at least two sources are required.");
  const seen=new Set<string>();
  for(const r of c.rows){
    if(typeof r.key!=="string"||!r.key||seen.has(r.key)||typeof r.name!=="string"||!r.name.trim()||!Number.isSafeInteger(r.currentQuantity)||r.currentQuantity<0||(r.previousQuantity!==null&&(!Number.isSafeInteger(r.previousQuantity)||r.previousQuantity<0))||(r.currentQuantity===0&&r.previousQuantity===0)||((r.note!==null&&typeof r.note!=="string")||(r.previousQuantity===null&&!r.note)))throw new Error("Invalid company quantities or duplicate security.");
    for(const w of [r.weight,r.previousWeight])if(w!==null&&(!Number.isFinite(w)||w<0||w>100))throw new Error("Invalid portfolio allocation.");
    seen.add(r.key);
  }
  if(c.rows.reduce((sum,r)=>sum+(r.weight??0),0)>100.1)throw new Error("Company allocations exceed net assets.");
  const domains=new Set<string>();
  for(const s of c.sources){if(typeof s.label!=="string"||typeof s.scope!=="string"||new URL(s.url).protocol!=="https:")throw new Error("Invalid comparison source.");domains.add(new URL(s.url).hostname);}
  if(new Set(c.sources.map(s=>s.url)).size<2)throw new Error("Use at least two distinct source URLs.");
  // Adjacent official AMC workbooks legitimately share a publisher domain.
  if(c.basis==="provider_quantity_comparison"&&domains.size<2)throw new Error("Provider comparisons require at least two source domains.");
}
