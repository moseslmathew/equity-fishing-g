import {notFound} from "next/navigation";
import {resolveNseSecurity} from "../../../lib/nse-security-links";
import CompanyDetails from "./company-details";
import "./company-details.css";

export const dynamic = "force-dynamic";

export default async function CompanyPage({params}:{params:Promise<{symbol:string}>}){
  const {symbol} = await params;
  const security = await resolveNseSecurity(symbol);
  if (!security) notFound();
  return <CompanyDetails key={symbol} security={security}/>;
}
