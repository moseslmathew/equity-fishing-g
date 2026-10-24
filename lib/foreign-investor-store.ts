import seed from "../data/foreign-investors.json";
import temasekSeed from "../data/foreign-investor-temasek.json";
import gicSeed from "../data/foreign-investor-gic.json";
import blackrockSeed from "../data/foreign-investor-blackrock.json";
import kkrSeed from "../data/foreign-investor-kkr.json";
import brookfieldSeed from "../data/foreign-investor-brookfield.json";
import adiaSeed from "../data/foreign-investor-adia.json";
import cppSeed from "../data/foreign-investor-cpp-investments.json";
import goldmanSeed from "../data/foreign-investor-goldman-sachs.json";
import governmentSeed from "../data/foreign-investor-government-of-singapore.json";
import amansaSeed from "../data/foreign-investor-amansa-holdings.json";
import monsoonSeed from "../data/foreign-investor-adia-monsoon.json";
import caladiumSeed from "../data/foreign-investor-caladium-investment.json";
import smallcapWorldSeed from "../data/foreign-investor-smallcap-world-fund.json";
import ebisuSeed from "../data/foreign-investor-ebisu-global-opportunities.json";
import unicoSeed from "../data/foreign-investor-unico-global-opportunities.json";
import newInvestor0 from "../data/foreign-investor-synnex-technology.json";
import newInvestor1 from "../data/foreign-investor-fidelity-low-priced-stock.json";
import newInvestor2 from "../data/foreign-investor-fidelity-international-small-cap.json";
import newInvestor3 from "../data/foreign-investor-government-pension-fund-global.json";
import newInvestor4 from "../data/foreign-investor-massachusetts-institute-of-technology.json";
import newInvestor5 from "../data/foreign-investor-rbc-emerging-markets-dividend.json";
import newInvestor6 from "../data/foreign-investor-vanguard-emerging-markets-stock-index.json";
import {database,documentStatement,ensureDatabase} from "./database-store";
import {validateForeignResearch,type ForeignResearch} from "./foreign-investors";
export const foreignInvestorIds=["blackstone","temasek","gic","blackrock","kkr","brookfield","adia","cpp-investments","goldman-sachs","government-of-singapore","amansa-holdings","adia-monsoon","caladium-investment","smallcap-world-fund","ebisu-global-opportunities","unico-global-opportunities","synnex-technology","fidelity-low-priced-stock","fidelity-international-small-cap","government-pension-fund-global","massachusetts-institute-of-technology","rbc-emerging-markets-dividend","vanguard-emerging-markets-stock-index"] as const;
const seeds:Record<string,ForeignResearch>={blackstone:seed as ForeignResearch,temasek:temasekSeed as ForeignResearch,gic:gicSeed as ForeignResearch,blackrock:blackrockSeed as ForeignResearch,kkr:kkrSeed as ForeignResearch,brookfield:brookfieldSeed as ForeignResearch,adia:adiaSeed as ForeignResearch,"cpp-investments":cppSeed as ForeignResearch,"goldman-sachs":goldmanSeed as ForeignResearch,"government-of-singapore":governmentSeed as ForeignResearch,"amansa-holdings":amansaSeed as ForeignResearch,"adia-monsoon":monsoonSeed as ForeignResearch,"caladium-investment":caladiumSeed as ForeignResearch,"smallcap-world-fund":smallcapWorldSeed as ForeignResearch,"ebisu-global-opportunities":ebisuSeed as ForeignResearch,"unico-global-opportunities":unicoSeed as ForeignResearch,"synnex-technology":newInvestor0 as ForeignResearch,"fidelity-low-priced-stock":newInvestor1 as ForeignResearch,"fidelity-international-small-cap":newInvestor2 as ForeignResearch,"government-pension-fund-global":newInvestor3 as ForeignResearch,"massachusetts-institute-of-technology":newInvestor4 as ForeignResearch,"rbc-emerging-markets-dividend":newInvestor5 as ForeignResearch,"vanguard-emerging-markets-stock-index":newInvestor6 as ForeignResearch};
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
