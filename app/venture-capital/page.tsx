import {ventureResearch} from "../../lib/venture-capital";
import VentureCapital from "../venture-capital";

export const dynamic = "force-dynamic";
export const metadata = {title:"Venture capital focused equity | Smallcap Observatory"};

export default function VentureCapitalPage(){
 return <VentureCapital research={ventureResearch}/>;
}
