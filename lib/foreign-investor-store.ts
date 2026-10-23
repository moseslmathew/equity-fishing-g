import seed from "../data/foreign-investors.json";
import temasekSeed from "../data/foreign-investor-temasek.json";
import gicSeed from "../data/foreign-investor-gic.json";
import blackrockSeed from "../data/foreign-investor-blackrock.json";
import kkrSeed from "../data/foreign-investor-kkr.json";
import brookfieldSeed from "../data/foreign-investor-brookfield.json";
import adiaSeed from "../data/foreign-investor-adia.json";
import cppSeed from "../data/foreign-investor-cpp-investments.json";
import {database,documentStatement,ensureDatabase} from "./database-store";
import {validateForeignResearch,type ForeignResearch} from "./foreign-investors";
export const foreignInvestorIds=["blackstone","temasek","gic","blackrock","kkr","brookfield","adia","cpp-investments"] as const;
const seeds:Record<string,ForeignResearch>={blackstone:seed as ForeignResearch,temasek:temasekSeed as ForeignResearch,gic:gicSeed as ForeignResearch,blackrock:blackrockSeed as ForeignResearch,kkr:kkrSeed as ForeignResearch,brookfield:brookfieldSeed as ForeignResearch,adia:adiaSeed as ForeignResearch,"cpp-investments":cppSeed as ForeignResearch};
export async function readForeignResearch(id="blackstone"){
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
