import {ventureResearch,ventureStatus} from './venture-capital';
import type {ForeignResearch,ForeignSource} from './foreign-investors';

// One evidence model feeds the unified browser and global company search.
export const ventureForeignResearch:ForeignResearch[]=ventureResearch.firms.map(firm=>{
 const sources:Record<string,ForeignSource>={identity:{title:firm.shortName+' official website',url:firm.website,publisher:firm.shortName,published:'Reviewed '+ventureResearch.reviewedAt,kind:'primary'}};
 const companies=firm.companies.map(c=>{
  const backing=c.id+'-backing';
  const official=/(peakxv\.com|accel\.com|lsvp\.com|sebi\.gov\.in|awfis\.com|meesho\.com)/.test(new URL(c.preIpoSource.url).hostname);
  sources[backing]={title:c.preIpoSource.label,url:c.preIpoSource.url,publisher:new URL(c.preIpoSource.url).hostname,published:'Reviewed '+ventureResearch.reviewedAt,kind:official?'primary':'reporting',note:'Pre-IPO backing; does not establish a retained stake.'};
  const holdingIds=c.holdings.map((h,i)=>{
   const id=c.id+'-holding-'+i;
   sources[id]={title:h.source.label,url:h.source.url,publisher:new URL(h.source.url).hostname,published:h.asOf,kind:h.evidence==='Filing'?'primary':'reporting',note:h.note};
   return id;
  });
  const status=ventureStatus(c),single=c.holdings.length===1?c.holdings[0]:undefined;
  const ownership=c.holdings.length?c.holdings.map(h=>`${h.percent===null?'Stake undisclosed':h.percent+'%'} · ${h.entity} (${h.asOf})`).join('; '):'Pre-IPO backing verified · remaining stake unconfirmed';
  return {id:c.id,name:c.name,ticker:c.ticker,listing:'Listed equity',sector:'Venture / growth capital',relationship:c.entry,ownership,ownershipDate:single?single.asOf:c.holdings.length?'Separate dated legal holders':'Ownership date unconfirmed',stakePercent:single?.percent??null,stance:status==='exited'?'exited' as const:status==='historical'?'historical' as const:status==='unknown'?'unconfirmed' as const:'held' as const,summary:c.note,thesis:firm.description,risks:c.holdings.map(h=>h.note).join(' ')||c.note,sourceIds:[...holdingIds,backing]};
 });
 return {id:firm.id,name:firm.shortName,category:'venture',asOf:ventureResearch.reviewedAt,checkedAt:'2026-11-11T16:00:00.000Z',windowStart:'2025-10-21',windowEnd:ventureResearch.reviewedAt,coverage:ventureResearch.scope,limitations:[firm.identityNote,'Historical backing is not proof of a current stake. Separate legal holders are never summed into an assumed group holding.','Underlying ownership evidence retains its original date; merging the views is not a new ownership verification.'],sources,companies,events:[],report:{title:firm.shortName+' · India exposure',summary:firm.description,sections:[{title:'Identity and scope',text:firm.identityNote,sourceIds:['identity']},{title:'Coverage',text:ventureResearch.scope,sourceIds:['identity']}],themes:[]}};
});
