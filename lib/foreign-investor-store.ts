import seed from "../data/foreign-investors.json";
import temasekSeed from "../data/foreign-investor-temasek.json";
import gicSeed from "../data/foreign-investor-gic.json";
import blackrockSeed from "../data/foreign-investor-blackrock.json";
import {database,documentStatement,ensureDatabase} from "./database-store";
import {validateForeignResearch,type ForeignResearch} from "./foreign-investors";
export async function readForeignResearch(id="blackstone"){
 const seeds:Record<string,ForeignResearch>={blackstone:seed as ForeignResearch,temasek:temasekSeed as ForeignResearch,gic:gicSeed as ForeignResearch,blackrock:blackrockSeed as ForeignResearch};
 const value=seeds[id]&&validateForeignResearch(seeds[id]);
 if(!value)return null;
 await ensureDatabase();
 let row=await database().prepare("SELECT payload,checked_at FROM app_documents WHERE key=?").bind("foreign-investor:"+id).first<{payload:string;checked_at:string}>();
 if(!row||new Date(row.checked_at)<new Date(value.checkedAt)){
  await database().batch([documentStatement(database(),"foreign-investor:"+id,value,value.checkedAt)]);
  row=await database().prepare("SELECT payload,checked_at FROM app_documents WHERE key=?").bind("foreign-investor:"+id).first<{payload:string;checked_at:string}>();
 }
 if(!row)throw new Error("Foreign investor research is unavailable.");
 return validateForeignResearch(JSON.parse(row.payload) as ForeignResearch);
}
