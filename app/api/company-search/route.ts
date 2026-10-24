import {readerAllowed,deny} from "../../../lib/access";
import {GET as aceGET} from "../investors/combined/route";
import {foreignInvestorIds,readForeignResearch} from "../../../lib/foreign-investor-store";
import {database,ensureDatabase,readDatabaseComparisons,readResearchSnapshot} from "../../../lib/database-store";
import {ventureResearch} from "../../../lib/venture-capital";
import type {Fund} from "../../../lib/portfolio";
import {schemeNames} from "../../../lib/fund-catalog";
import {searchCompanies,type SearchInput} from "../../../lib/company-search";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
async function searchPortfolio():Promise<NonNullable<SearchInput["portfolio"]>>{
 await ensureDatabase();
 const [result,comparisons]=await Promise.all([database().prepare("SELECT payload FROM fund_snapshots ORDER BY reporting_date DESC,checked_at DESC").all<{payload:string}>(),readDatabaseComparisons()]);
 const latest=new Map<string,Fund>();
 for(const row of result.results){const fund=JSON.parse(row.payload) as Fund;if(schemeNames[fund.id]&&!latest.has(fund.id))latest.set(fund.id,{...fund,name:schemeNames[fund.id]});}
 const funds=[...latest.values()];
 if(!funds.length)throw new Error('Fund data unavailable');
 return {funds,fullComparisons:comparisons.filter(c=>funds.some(f=>f.id===c.fundId&&f.portfolioDate===c.currentDate)),previousFunds:[],previousMonth:""};
}
async function json(response:Response){if(!response.ok)throw new Error("Source unavailable");return response.json();}
export async function GET(request:Request){
 if(!await readerAllowed(request.headers))return deny();
 const query=(new URL(request.url).searchParams.get("q")??"").trim();
 if(query.length<2||!/[\p{L}\p{N}]/u.test(query))return Response.json({total:0,companies:[],unavailable:[]},{headers});
 if(query.length>100)return Response.json({error:"Use 100 characters or fewer."},{status:400,headers});
 const result=await Promise.allSettled([
  searchPortfolio(),
  aceGET(request).then(json),
  Promise.all(foreignInvestorIds.map(id=>readForeignResearch(id))).then(rows=>{if(rows.some(r=>!r))throw new Error('Incomplete coverage');return rows as NonNullable<typeof rows[number]>[];}),
  readResearchSnapshot()
 ]);
 const labels=["Mutual funds","Ace investors","Foreign investors","AI Insights"];
 const unavailable=result.flatMap((r,i)=>r.status==="rejected"?[labels[i]]:[]);
 const value=(i:number)=>result[i].status==="fulfilled"?result[i].value:undefined;
 const input:SearchInput={portfolio:value(0) as SearchInput["portfolio"],ace:value(1) as SearchInput["ace"],foreign:value(2) as SearchInput["foreign"],research:value(3) as SearchInput["research"],venture:ventureResearch};
 return Response.json({...searchCompanies(input,query),unavailable},{headers});
}
