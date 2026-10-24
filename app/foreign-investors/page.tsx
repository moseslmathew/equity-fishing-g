import {readForeignResearch,foreignInvestorIds} from "../../lib/foreign-investor-store";
import ForeignInvestors from "../foreign-investors";

export const dynamic = "force-dynamic";

export default async function ForeignInvestorsPage(){
 const datasets = await Promise.all(foreignInvestorIds.map(async id=>{
  const data = await readForeignResearch(id);
  if (!data) throw new Error("Research unavailable: "+id);
  return data;
 }));
 return <ForeignInvestors datasets={datasets}/>;
}
