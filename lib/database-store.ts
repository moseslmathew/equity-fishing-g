import {env} from "cloudflare:workers";
import {neon} from "@neondatabase/serverless";
import seed from "../data/seed.json";
import september from "../data/september-portfolios.json";
import fullSeed from "../data/full-portfolio-seed.json";
import researchSeed from "../data/agent-research.json";
import philosophies from "../data/investor-philosophies.json";
import {investorProfiles} from "./investor-registry";
import type {Portfolio,Fund} from "./portfolio";
import {validateFullComparison,type FullComparison} from "./full-portfolio";
import type {InvestorPortfolio} from "./ace-investor-view";

export type PreparedQuery = {
  first: <T = any>() => Promise<T | null>;
  all: <T = any>() => Promise<{ results: T[] }>;
  run: () => Promise<{ success: boolean }>;
  _sql?: string;
  _params?: any[];
};

export type DatabaseClient = {
  prepare: (query: string) => PreparedQuery & {
    bind: (...params: any[]) => PreparedQuery;
  };
  batch: (statements: any[]) => Promise<void>;
};

let neonDbInstance: DatabaseClient | null = null;
let lastNeonUrl: string | null = null;

function getNeonDatabase(url: string): DatabaseClient {
  if (neonDbInstance && lastNeonUrl === url) return neonDbInstance;
  const sql = neon(url);
  function toPgSql(query: string) {
    let index = 0;
    return query.replace(/\?/g, () => `$${++index}`).replace(/\bORDER BY rowid\b/gi, "ORDER BY key");
  }

  const client: DatabaseClient = {
    prepare(query: string) {
      const pgSql = toPgSql(query);
      let boundParams: any[] = [];
      const stmt: PreparedQuery & { bind: (...params: any[]) => any } = {
        bind(...params: any[]) {
          boundParams = params;
          return stmt;
        },
        async first<T = any>() {
          const rows = await sql.query(pgSql, boundParams);
          return (rows[0] as T) ?? null;
        },
        async all<T = any>() {
          const rows = await sql.query(pgSql, boundParams);
          return { results: rows as T[] };
        },
        async run() {
          await sql.query(pgSql, boundParams);
          return { success: true };
        },
        get _sql() {
          return pgSql;
        },
        get _params() {
          return boundParams;
        },
      };
      return stmt as any;
    },
    async batch(statements: any[]) {
      await Promise.all(
        statements.map(async (s) => {
          if (s._sql) {
            await sql.query(s._sql, s._params || []);
          } else if (typeof s.run === "function") {
            await s.run();
          }
        })
      );
    },
  };
  neonDbInstance = client;
  lastNeonUrl = url;
  return client;
}

export function database(): DatabaseClient {
  const neonUrl = (env as any)?.DATABASE_URL || process.env.DATABASE_URL;
  if (neonUrl) {
    return getNeonDatabase(neonUrl);
  }
  const db = (env as Cloudflare.Env).DB;
  if (!db) throw new Error("Database storage unavailable.");
  return db as unknown as DatabaseClient;
}

const iso=(s:string)=>new Date(s).toISOString();
const parse=<T>(row:{payload:string}|null):T|null=>row?JSON.parse(row.payload):null;
export function documentStatement(db:DatabaseClient,key:string,value:unknown,checkedAt:string){return db.prepare("INSERT INTO app_documents (key,payload,checked_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,checked_at=excluded.checked_at WHERE excluded.checked_at>=app_documents.checked_at").bind(key,JSON.stringify(value),iso(checkedAt));}
export function fundStatement(db:DatabaseClient,f:Fund){return db.prepare("INSERT INTO fund_snapshots (id,fund_id,month,reporting_date,checked_at,payload) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,checked_at=excluded.checked_at WHERE excluded.checked_at>=fund_snapshots.checked_at").bind(f.id+":"+f.portfolioDate,f.id,f.portfolioDate.slice(0,7),f.portfolioDate,iso(f.lastCheckedAt),JSON.stringify(f));}
export function comparisonStatement(db:DatabaseClient,c:FullComparison){return db.prepare("INSERT INTO fund_comparisons (id,fund_id,month,checked_at,payload) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,checked_at=excluded.checked_at WHERE excluded.checked_at>=fund_comparisons.checked_at").bind(c.fundId+":"+c.currentDate,c.fundId,c.currentDate.slice(0,7),iso(c.checkedAt),JSON.stringify(c));}
function investorStatement(db:DatabaseClient,id:string,p:InvestorPortfolio){return db.prepare("INSERT INTO investor_portfolios (id,investor_id,checked_at,payload) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload WHERE excluded.checked_at>=investor_portfolios.checked_at").bind(id+":"+p.checkedOn,id,iso(p.checkedOn),JSON.stringify(p));}
async function batches(db:DatabaseClient,statements:any[]){for(let i=0;i<statements.length;i+=25)await db.batch(statements.slice(i,i+25));}
function accepted(f:Fund){return f.verification!=="conflict"&&f.checkStatus!=="failed"&&f.checkStatus!=="conflict";}
let initializing:Promise<void>|undefined;
// Data backfill is deliberately outside schema migrations. Retry-safe upserts never replace newer records.
export async function ensureDatabase(){
 const db=database();if(await db.prepare("SELECT key FROM app_documents WHERE key=?").bind("migration:legacy-v1").first()){await importSeptember(db);return;}
 if(!initializing)initializing=importLegacy(db).catch(e=>{initializing=undefined;throw e;});
 await initializing;
 await importSeptember(db);
}
async function importSeptember(db:DatabaseClient){
 const marker="import:september-2026:"+september.checkedAt;
 if(await db.prepare("SELECT key FROM app_documents WHERE key=?").bind(marker).first())return;
 await batches(db,[...(seed.funds as Fund[]).filter(accepted).map(f=>fundStatement(db,f)),...(september.funds as Fund[]).filter(accepted).map(f=>fundStatement(db,f)),...september.comparisons.map(c=>{validateFullComparison(c);return comparisonStatement(db,c as FullComparison);})]);
 await db.batch([documentStatement(db,marker,{funds:september.funds.length,comparisons:september.comparisons.length},september.checkedAt)]);
}
async function importLegacy(db:DatabaseClient){
 const statements:any[]=[];
 const p=seed as Portfolio;
 statements.push(documentStatement(db,"portfolio:current",p,p.checkedAt));
 for(const f of [...p.funds,...september.funds] as Fund[])if(accepted(f))statements.push(fundStatement(db,f));
 for(const c of [...fullSeed,...september.comparisons] as FullComparison[]){validateFullComparison(c);statements.push(comparisonStatement(db,c));}
 for(const profile of investorProfiles){statements.push(investorStatement(db,profile.id,profile.portfolio));const {portfolio,...meta}=profile;statements.push(documentStatement(db,"investor:"+profile.id,{...meta,holdingsCount:portfolio.holdings.length,idea:philosophies[profile.id as keyof typeof philosophies]},portfolio.checkedOn));}
 statements.push(db.prepare("INSERT INTO research_reports (id,checked_at,model,fingerprint,payload) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(researchSeed.id,iso(researchSeed.checkedAt),researchSeed.modelName,researchSeed.portfolioFingerprint,JSON.stringify(researchSeed)));
 await batches(db,statements);
 const bucket=(env as Cloudflare.Env)?.BUCKET;
 if(bucket){
  try{
   const current=await bucket.get("portfolio/current.json");
   if(current){const value=await current.json<Portfolio>();await db.batch([documentStatement(db,"portfolio:current",value,value.checkedAt),...value.funds.filter(accepted).map(f=>fundStatement(db,f))]);}
   let cursor:string|undefined;
   do{
    const page=await bucket.list({prefix:"portfolio/",cursor});
    const keys=page.objects.filter(o=>/^portfolio\/(months|full)\/\d{4}-\d{2}\/[^/]+\.json$/.test(o.key));
    for(let i=0;i<keys.length;i+=5){const rows=await Promise.all(keys.slice(i,i+5).map(async o=>{const obj=await bucket.get(o.key);if(!obj)return null;if(o.key.startsWith("portfolio/full/")){const c=await obj.json<FullComparison>();validateFullComparison(c);return comparisonStatement(db,c);}const f=await obj.json<Fund>();return accepted(f)?fundStatement(db,f):null;}));await batches(db,rows.filter((s):s is any=>s!==null));}
    cursor=page.truncated?page.cursor:undefined;
   }while(cursor);
  }catch(e){console.warn("Legacy bucket migration notice:",e);}
 }
 await db.batch([documentStatement(db,"migration:legacy-v1",{completedAt:new Date().toISOString(),source:"Bundled records and legacy R2 portfolio archive",backupsRetained:true},new Date().toISOString())]);
}
export async function readCurrentPortfolio(){await ensureDatabase();const p=parse<Portfolio>(await database().prepare("SELECT payload FROM app_documents WHERE key=?").bind("portfolio:current").first<{payload:string}>());if(!p)throw new Error("Current portfolio missing.");return p;}
export async function readDatabaseFunds(month:string){await ensureDatabase();const result=await database().prepare("SELECT payload FROM fund_snapshots WHERE month=? ORDER BY checked_at DESC").bind(month).all<{payload:string}>();const latest=new Map<string,Fund>();for(const r of result.results){const f=JSON.parse(r.payload) as Fund;if(!latest.has(f.id))latest.set(f.id,f);}return [...latest.values()];}
export async function availableDatabaseMonths(): Promise<string[]>{await ensureDatabase();return (await database().prepare("SELECT DISTINCT month FROM fund_snapshots ORDER BY month DESC").all<{month:string}>()).results.map((r: {month:string})=>r.month);}
export async function readDatabaseComparisons(month?:string): Promise<FullComparison[]>{await ensureDatabase();const rows=month?await database().prepare("SELECT payload FROM fund_comparisons WHERE month=? ORDER BY fund_id").bind(month).all<{payload:string}>():await database().prepare("SELECT payload FROM fund_comparisons ORDER BY month,fund_id").all<{payload:string}>();return rows.results.map((r: {payload:string})=>JSON.parse(r.payload) as FullComparison);}
export async function saveComparison(c:FullComparison){await ensureDatabase();await database().batch([comparisonStatement(database(),c)]);}
export async function savePortfolio(p:Portfolio,previous:Portfolio){await ensureDatabase();await database().batch([...previous.funds.filter(accepted).map(f=>fundStatement(database(),f)),...p.funds.filter(accepted).map(f=>fundStatement(database(),f)),documentStatement(database(),"portfolio:current",p,p.checkedAt)]);}
export async function readInvestorCards(): Promise<any[]>{await ensureDatabase();return (await database().prepare("SELECT payload FROM app_documents WHERE key LIKE 'investor:%' ORDER BY key").all<{payload:string}>()).results.map((r: {payload:string})=>JSON.parse(r.payload));}
export async function readInvestorPortfolio(id:string){await ensureDatabase();return parse<InvestorPortfolio>(await database().prepare("SELECT payload FROM investor_portfolios WHERE investor_id=? ORDER BY checked_at DESC LIMIT 1").bind(id).first<{payload:string}>());}
export async function readResearchSnapshot(){await ensureDatabase();await database().prepare("INSERT INTO research_reports (id,checked_at,model,fingerprint,payload) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(researchSeed.id,iso(researchSeed.checkedAt),researchSeed.modelName,researchSeed.portfolioFingerprint,JSON.stringify(researchSeed)).run();const p=parse<typeof researchSeed>(await database().prepare("SELECT payload FROM research_reports WHERE id NOT LIKE 'ace-%' ORDER BY checked_at DESC LIMIT 1").first<{payload:string}>());if(!p)throw new Error("Research report missing.");return p;}
export async function saveInvestorPortfolio(id:string,p:InvestorPortfolio){await ensureDatabase();const db=database();const row=await db.prepare("SELECT payload FROM app_documents WHERE key=?").bind("investor:"+id).first<{payload:string}>();if(!row)throw new Error("Unknown investor.");const meta=JSON.parse(row.payload);meta.holdingsCount=p.holdings.length;await db.batch([investorStatement(db,id,p),documentStatement(db,"investor:"+id,meta,p.checkedOn)]);}
export async function saveResearchSnapshot(p:typeof researchSeed){await ensureDatabase();await database().batch([database().prepare("INSERT INTO research_reports (id,checked_at,model,fingerprint,payload) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(p.id+":"+iso(p.checkedAt),iso(p.checkedAt),p.modelName,p.portfolioFingerprint,JSON.stringify(p))]);}
