import {headers} from "next/headers";
import {sessionValid} from "../../lib/access";
import {readForeignResearch,foreignInvestorIds} from "../../lib/foreign-investor-store";
import Login from "../login";
import ForeignInvestors from "../foreign-investors";
export const dynamic="force-dynamic";
export default async function ForeignInvestorsPage(){
 if(!await sessionValid(await headers()))return <Login/>;
 const datasets=await Promise.all(foreignInvestorIds.map(async id=>{
  const data=await readForeignResearch(id);
  if(!data)throw new Error("Research unavailable: "+id);
  return data;
 }));
 return <ForeignInvestors datasets={datasets}/>;
}
