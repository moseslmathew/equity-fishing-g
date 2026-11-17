import editorial from '../data/investor-outlook.json';
import fii from '../data/fii-quarterly.json';
import type {threeMonthResearch} from './three-month-research';
export function investorOutlook(deep:ReturnType<typeof threeMonthResearch>|null){
 if(!deep?.available||deep.months.at(-1)!==editorial.holdingsMonth)return null;
 const reviewed=deep.companyEvidence.filter(e=>editorial.cases.some(c=>e.name.toLowerCase().includes(c.match.toLowerCase())));
 if(JSON.stringify(reviewed)!==JSON.stringify(editorial.reviewedHoldings))return null;
 return {...editorial,cases:editorial.cases.flatMap(c=>{
  const matches=deep.companyEvidence.filter(e=>e.name.toLowerCase().includes(c.match.toLowerCase()));
  if(matches.length!==1)return [];
  const evidence=matches[0];
  const foreign=fii.securities[c.symbol as keyof typeof fii.securities];
  const quarters=foreign?.quarters as Record<string,number>|undefined;
  const before=quarters?.['2026-06'],after=quarters?.['2026-09'];
  return [{...c,evidence,foreign:before!==undefined&&after!==undefined?{before,after,change:after-before,source:foreign.source,checkedAt:fii.checkedAt}:null}];
 })};
}
