import {headers} from "next/headers";
import {sessionValid} from "../../lib/access";
import {ventureResearch} from "../../lib/venture-capital";
import Login from "../login";
import VentureCapital from "../venture-capital";
export const dynamic="force-dynamic";
export const metadata={title:"Venture capital focused equity | Smallcap Observatory"};
export default async function VentureCapitalPage(){
 if(!await sessionValid(await headers()))return <Login/>;
 return <VentureCapital research={ventureResearch}/>;
}
