import {headers} from "next/headers";
import {notFound} from "next/navigation";
import {sessionValid} from "../../../lib/access";
import {nseSecurity} from "../../../lib/nse-security-links";
import Login from "../../login";
import CompanyDetails from "./company-details";
import "./company-details.css";
export const dynamic="force-dynamic";
export default async function CompanyPage({params}:{params:Promise<{symbol:string}>}){
  if(!await sessionValid(await headers()))return <Login/>;
  const {symbol}=await params,security=nseSecurity(symbol);
  if(!security)notFound();
  return <CompanyDetails key={symbol} security={security}/>;
}
