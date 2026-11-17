import {companyIdentity} from './company-identity';
import {schemeNames} from './fund-catalog';
import type {FullComparison,FullHolding} from './full-portfolio';
const shift=(s:string,n:number)=>{const [y,m]=s.split('-').map(Number);return new Date(Date.UTC(y,m-1+n,1)).toISOString().slice(0,7);};
const fmt=(n:number)=>new Intl.NumberFormat('en-IN',{maximumFractionDigits:2}).format(n);
const monthEnd=(m:string)=>{const [y,n]=m.split('-').map(Number);return new Date(Date.UTC(y,n,0)).toISOString().slice(0,10);};
const signed=(n:number)=>`${n>0?'+':''}${fmt(n)}`;
export function threeMonthResearch(input:FullComparison[],month:string){
 const months=[shift(month,-2),shift(month,-1),month];
 const latest=new Map<string,FullComparison>();
 for(const c of input){const m=c.currentDate.slice(0,7);if(!months.slice(1).includes(m)||c.previousDate.slice(0,7)!==shift(m,-1)||c.scope!=='full_equity'||c.currentDate!==monthEnd(m)||c.previousDate!==monthEnd(shift(m,-1)))continue;const key=c.fundId+':'+m;const old=latest.get(key);if(!old||Date.parse(c.checkedAt)>Date.parse(old.checkedAt))latest.set(key,c);}
 const identity=companyIdentity([...latest.values()].flatMap(c=>c.rows));
 const grouped=(c:FullComparison)=>{const map=new Map<string,FullHolding[]>();for(const row of c.rows){const id=identity(row).id;map.set(id,[...(map.get(id)??[]),row]);}return map;};
 type Position={fundId:string;fund:string;name:string;key:string;q:number[];w:(number|null)[];delta:number[];primary:boolean;sources:FullComparison['sources']};
 const positions:Position[]=[],excluded:{fund:string;company:string;reason:string}[]=[],funds:string[]=[];
 for(const a of latest.values()){
  if(!a.currentDate.startsWith(months[1]))continue;
  const b=latest.get(a.fundId+':'+month);if(!b)continue;funds.push(a.fundId);
  const aa=grouped(a),bb=grouped(b);
  for(const key of new Set([...aa.keys(),...bb.keys()])){
   const ar=aa.get(key)??[],br=bb.get(key)??[],x=ar[0],y=br[0],name=y?.name??x.name;
   let reason=ar.length>1||br.length>1?'Multiple security rows share an identity':x?.note||y?.note?'Source flags this position for review':x?.previousQuantity===null||y?.previousQuantity===null?'Missing prior quantity':(x?.currentQuantity??0)!==(y?.previousQuantity??0)?'Middle-month quantities disagree':'';
   if(reason){excluded.push({fund:schemeNames[a.fundId]??a.fundId,company:name,reason});continue;}
   const q=[x?.previousQuantity??0,x?.currentQuantity??0,y?.currentQuantity??0];
   const w=[x?x.previousWeight:0,x?x.weight:0,y?y.weight:0];
   if(x?.weight!=null&&y?.previousWeight!=null&&Math.abs(x.weight-y.previousWeight)>.02){excluded.push({fund:schemeNames[a.fundId]??a.fundId,company:name,reason:'Middle-month allocations disagree by more than 0.02 pp'});continue;}
   positions.push({key,name,fundId:a.fundId,fund:schemeNames[a.fundId]??a.fundId,q,w,delta:[q[1]-q[0],q[2]-q[1]],primary:a.basis==='official_disclosures'&&b.basis==='official_disclosures',sources:[...a.sources,...b.sources]});
  }
 }
 const companies=[...new Set(positions.map(p=>p.key))].map(key=>{
  const rows=positions.filter(p=>p.key===key),q=[0,1,2].map(i=>rows.reduce((n,p)=>n+p.q[i],0));
  const repeat=rows.filter(p=>p.delta.every(d=>d>0)),cuts=rows.filter(p=>p.delta.every(d=>d<0)),reversal=rows.filter(p=>p.delta[0]>0&&p.delta[1]<0);
  const adds=rows.filter(p=>p.delta[1]>0),reduces=rows.filter(p=>p.delta[1]<0),positive=adds.reduce((n,p)=>n+p.delta[1],0);
  return {key,name:rows[0].name,rows,q,repeat,cuts,reversal,adds,reduces,holders:[0,1,2].map(i=>rows.filter(p=>p.q[i]>0).length),net:q[2]-q[0],growth:q[0]>0?100*(q[2]-q[0])/q[0]:null,dominance:positive?100*Math.max(...adds.map(p=>p.delta[1]))/positive:null};
 });
 const persistent=companies.filter(c=>c.repeat.length>=2).sort((a,b)=>b.repeat.length-a.repeat.length||b.adds.length-a.adds.length);
 const selling=companies.filter(c=>c.cuts.length>=2).sort((a,b)=>b.cuts.length-a.cuts.length);
 const reversals=positions.filter(p=>p.delta[0]>0&&p.delta[1]<0).sort((a,b)=>Math.abs(b.delta[1])/b.q[1]-Math.abs(a.delta[1])/a.q[1]);
 const hidden=positions.filter(p=>p.delta[1]>0&&p.q[1]>0&&p.w[1]!=null&&p.w[2]!=null&&p.w[2]!<p.w[1]!).sort((a,b)=>(a.w[2]!-a.w[1]!)-(b.w[2]!-b.w[1]!));
 const newLast=positions.filter(p=>p.q[0]===0&&p.q[1]>0),retained=newLast.filter(p=>p.q[2]>0),abandoned=newLast.filter(p=>p.q[2]===0);
 const broadening=companies.filter(c=>c.holders[2]>c.holders[0]).sort((a,b)=>(b.holders[2]-b.holders[0])-(a.holders[2]-a.holders[0]));
 const dominant=companies.filter(c=>c.adds.length>=2&&c.reduces.length>0&&c.dominance!==null).sort((a,b)=>b.dominance!-a.dominance!);
 const sources:FullComparison['sources']=[];
 const refs=(rows:Position[])=>[...new Set(rows.flatMap(p=>p.sources).map(s=>{let i=sources.findIndex(x=>x.url===s.url);if(i<0){i=sources.length;sources.push(s);}return i;}))];
 const trajectory=(c:typeof companies[number])=>`${c.name}: ${c.holders.join(' → ')} observed holders; ${c.q.map(fmt).join(' → ')} shares across reconciled positions. Two-month change ${signed(c.net)} shares${c.growth===null?' (zero starting base; percentage growth undefined)':` (${signed(c.growth)}%)`}.`;
 const rowText=(p:Position)=>`${p.name} / ${p.fund}: ${p.q.map(fmt).join(' → ')} shares; changes ${signed(p.delta[0])}, then ${signed(p.delta[1])}.`;
 const conflicting=persistent.find(c=>c.net<0);
 const highlights=[
 ...(conflicting?[{title:'Persistence can conceal a shrinking total',text:`${conflicting.name}: ${conflicting.repeat.length} funds added in both intervals, yet the reconciled combined quantity fell ${fmt(-conflicting.growth!)}% over two months. Other reductions outweighed those repeat additions.`}]:[]),
 ...(hidden[0]?[{title:'Allocation is not share movement',text:`${hidden[0].name} / ${hidden[0].fund}: shares increased ${fmt(100*hidden[0].delta[1]/hidden[0].q[1])}% in the latest interval while weight fell ${fmt(hidden[0].w[1]!-hidden[0].w[2]!)} percentage points.`}]:[]),
 {title:'Most new positions survived one more month',text:newLast.length?`${retained.length} of ${newLast.length} first-interval initiations remained at the final month-end (${fmt(100*retained.length/newLast.length)}%). ${abandoned.length} returned to zero; this is persistence, not a return measure.`:'No first-interval initiations passed reconciliation; retention cannot be calculated.'}
 ];
 const stories=[
  {label:'01 / PERSISTENCE',title:'The same funds increased positions twice',paragraphs:[`${persistent.length} companies have at least two funds increasing quantities in both monthly intervals. This is stronger persistence than a one-month addition, but the funds may share an AMC and their decisions are not necessarily independent.`,...persistent.slice(0,5).map(c=>trajectory(c)+` Repeat adders: ${c.repeat.map(p=>p.fund).join(', ')}. Latest interval: ${c.adds.length} adding versus ${c.reduces.length} reducing.`),'Interpretation: these names merit an earnings-and-valuation follow-up because the position increase persisted across two observations. The archive does not establish why the manager added, the purchase price, or future returns.'],refs:refs(persistent.slice(0,5).flatMap(c=>c.rows))},
  {label:'02 / PERSISTENT REDUCTIONS',title:'Where reductions continued across both intervals',paragraphs:[`${selling.length} companies have at least two funds reducing quantities twice.`,...selling.slice(0,5).map(c=>trajectory(c)+` Repeat reducers: ${c.cuts.map(p=>p.fund).join(', ')}.`),'Interpretation: repeated reductions warrant checking position size, redemptions and company developments. They establish shrinking recorded positions, not a proven deterioration in the business.'],refs:refs(selling.slice(0,5).flatMap(c=>c.rows))},
  {label:'03 / REVERSALS',title:'Additions that were partly or fully unwound one month later',paragraphs:[`${reversals.length} fund–company positions increased in the first interval and decreased in the second. Examples are ordered by the fraction of the middle-month position reduced.`,...reversals.slice(0,6).map(p=>rowText(p)+` ${fmt(-100*p.delta[1]/p.q[1])}% of the middle-month quantity was reduced; ${p.q[2]>p.q[0]?'the ending position still exceeds the initial position':p.q[2]===p.q[0]?'the ending position returned to its initial size':'the ending position is below its initial size'}.`),'Interpretation: an initial addition should not be described as sustained accumulation when the next disclosure reverses it. Month-end data cannot reveal the sequence of trades within a month.'],refs:refs(reversals.slice(0,6))},
  {label:'04 / ALLOCATION DIVERGENCE',title:'More shares, yet a smaller portfolio weight',paragraphs:[`${hidden.length} reconciled positions added shares in the latest interval while their allocation percentage fell.`,...hidden.slice(0,6).map(p=>`${rowText(p)} Allocation ${fmt(p.w[1]!)}% → ${fmt(p.w[2]!)}%, a ${signed(p.w[2]!-p.w[1]!)} pp change despite ${signed(100*p.delta[1]/p.q[1])}% more shares.`),'Interpretation: weight depends on the market value of the holding divided by total fund net assets. Relative price performance, fund flows or changes elsewhere can lower weight while quantity rises. These disclosures alone cannot isolate those effects or calculate cash spent.'],refs:refs(hidden.slice(0,6))},
  {label:'05 / NEW-POSITION SURVIVAL',title:'Did new positions survive the next disclosure?',paragraphs:[`${newLast.length} positions started from zero in the first month and became positive in the middle month. ${retained.length} remained positive at the end (${newLast.length?fmt(100*retained.length/newLast.length):'unavailable'}% retention); ${abandoned.length} returned to zero.`,...abandoned.slice(0,5).map(rowText),'Interpretation: this checks whether an initiation lasted through the next month-end. It does not measure investment performance. Positions newly initiated in the final month have no follow-up observation and are excluded from the retention denominator.'],refs:refs(newLast)},
  {label:'06 / BREADTH',title:'Companies gaining holders in a constant fund sample',paragraphs:[`${broadening.length} companies gained observed holders between the first and last months within the matched fund sample.`,...broadening.slice(0,5).map(trajectory),'Interpretation: growth in holder count is measured using the same funds, so adding a newly covered scheme cannot manufacture this signal. Company totals include only reconciled positions; excluded positions are listed below. More holders can also increase crowdedness.'],refs:refs(broadening.slice(0,5).flatMap(c=>c.rows))},
  {label:'07 / CONCENTRATION',title:'When a broad-looking signal is dominated by one fund',paragraphs:[...dominant.slice(0,5).map(c=>`${c.name}: ${c.adds.length} funds increased and ${c.reduces.length} decreased in the last interval. ${c.adds.reduce((a,b)=>a.delta[1]>=b.delta[1]?a:b).fund} accounts for ${fmt(c.dominance!)}% of gross positive share changes in this company. Net change across the reconciled sample: ${signed(c.q[2]-c.q[1])} shares.`),'Interpretation: a positive total can conceal disagreement and dependence on one fund. The concentration denominator is the sum of positive quantity changes for the same company; share counts across different companies are never treated as comparable investment amounts.'],refs:refs(dominant.slice(0,5).flatMap(c=>c.rows))}
 ];
 return {months,funds,companyEvidence:companies.map(c=>({name:c.name,key:c.key,quantities:c.q,holders:c.holders,growth:c.growth,repeatAdders:c.repeat.map(p=>p.fund),repeatReducers:c.cuts.map(p=>p.fund),adding:c.adds.length,reducing:c.reduces.length,primaryPositions:c.rows.filter(p=>p.primary).length,positionCount:c.rows.length,sources:[...new Map(c.rows.flatMap(p=>p.sources).map(s=>[s.url,s])).values()]})),highlights,positions:positions.length,companies:companies.length,excluded,primaryPositions:positions.filter(p=>p.primary).length,sources,stories,counts:{persistent:persistent.length,persistentReductions:selling.length,reversals:reversals.length,allocationDivergence:hidden.length,initiations:newLast.length,retained:retained.length,abandoned:abandoned.length,broadening:broadening.length},available:positions.length>0};
}
