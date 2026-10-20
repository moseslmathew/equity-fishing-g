import {headers} from "next/headers";
import {sessionValid} from "../../lib/access";
import Login from "../login";
import SectorFunds from "../sector-funds";
export const dynamic="force-dynamic";
export default async function SectorsPage(){return await sessionValid(await headers())?<SectorFunds/>:<Login/>;}
