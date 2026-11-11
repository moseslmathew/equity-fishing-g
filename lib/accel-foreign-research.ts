import {ventureResearch} from "./venture-capital";
import type {ForeignResearch,ForeignSource} from "./foreign-investors";

// Share the reviewed evidence with Venture capital so the two views cannot drift.
const firm=ventureResearch.firms.find(firm=>firm.id==="accel")!;
const sources:Record<string,ForeignSource>={};
const sectors:Record<string,string>={"urban-company":"Home services",swiggy:"Food delivery & quick commerce",blackbuck:"Trucking & logistics",amagi:"Cloud media software",rentomojo:"Furniture & appliance rental"};
const companies=firm.companies.map(company=>{
 const backingId=company.id+"-backing";
 sources[backingId]={title:company.preIpoSource.label,url:company.preIpoSource.url,publisher:"Accel",published:"Reviewed "+ventureResearch.reviewedAt,kind:"primary",note:"Investment history; does not establish current ownership."};
 const holdingIds=company.holdings.map((holding,index)=>{
  const id=company.id+"-holding-"+index;
  sources[id]={title:holding.source.label,url:holding.source.url,publisher:new URL(holding.source.url).hostname,published:holding.asOf,kind:"reporting",note:holding.note};
  return id;
 });
 const reviewIds=company.reviewSource?[company.id+"-review"]:[];
 if(company.reviewSource)sources[reviewIds[0]]={title:company.reviewSource.label,url:company.reviewSource.url,publisher:new URL(company.reviewSource.url).hostname,published:"Reviewed "+ventureResearch.reviewedAt,kind:company.reviewSource.url.includes("swiggy.com")?"primary":"reporting",note:"Context only; not a reconciled current stake."};
 // Multiple legal vehicles must never become an assumed group total.
 const holding=company.holdings.length===1?company.holdings[0]:undefined;
 return {id:company.id,name:company.name,ticker:company.ticker,listing:"Listed equity",sector:sectors[company.id],relationship:holding?"Venture / growth capital · Named holder: "+holding.entity:"Historical pre-IPO investor · remaining stake unconfirmed",ownership:holding?holding.percent+"% reported company equity · "+holding.entity:"Current stake not confirmed",ownershipDate:holding?holding.asOf:"Reviewed "+ventureResearch.reviewedAt+" · ownership date unconfirmed",stakePercent:holding?.percent??null,stance:holding?"held" as const:"proposed" as const,summary:company.entry+" "+company.note,thesis:company.entry,risks:holding?.note??company.note,sourceIds:[...holdingIds,backingId,...reviewIds]};
});
export const accelForeignResearch:ForeignResearch={
 id:"accel",name:"Accel",asOf:ventureResearch.reviewedAt,checkedAt:ventureResearch.reviewedAt+"T00:00:00.000Z",windowStart:"2025-10-21",windowEnd:ventureResearch.reviewedAt,
 coverage:"Venture / growth capital. Five reviewed Indian-listed pre-IPO investments, using the same dated evidence as Venture capital.",
 limitations:[firm.identityNote,"Inclusion in Foreign investors describes foreign investment exposure; it does not assert that every Accel vehicle is a registered FPI.","Selected research coverage, not a complete portfolio. September stakes are public filing summaries and are not independently reconciled original filings.","Pre-IPO backing does not establish a retained stake. Unknown ownership is not treated as zero or a confirmed exit.","Evidence was reviewed on 21 October 2026; adding this view does not refresh its underlying disclosures."],
 sources,companies,
 events:companies.filter(company=>company.stakePercent!==null).map(company=>({id:company.id+"-snapshot",companyId:company.id,date:company.ownershipDate,dateLabel:company.ownershipDate,title:"Dated named-holder ownership",kind:"snapshot",direction:"held",status:"Snapshot",detail:company.ownership,qualification:"Ownership snapshot only; no purchase or sale is inferred.",sourceIds:company.sourceIds})),
 report:{title:"Accel · Indian-listed exposure",summary:"Two dated named-holder stakes and three historical pre-IPO relationships with unconfirmed remaining ownership.",sections:[{title:"Investment approach",text:firm.description+" "+firm.identityNote,sourceIds:companies.map(company=>company.id+"-backing")},{title:"Ownership evidence",text:"Urban Company and Swiggy retain the dated Accel India IV (Mauritius) Limited disclosures. BlackBuck, Amagi and Rentomojo retain unconfirmed current ownership; no group total or full exit is inferred.",sourceIds:companies.flatMap(company=>company.sourceIds)}],themes:[]}
};
