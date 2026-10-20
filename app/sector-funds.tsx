"use client";
import {useState} from "react";
import SearchField from "./search-field";
import {matchesSearch} from "../lib/search";
import {Zap,Car,ShoppingBasket} from "lucide-react";
import WorkspaceHeader from "./workspace-header";
const sectors=[{id:"energy",name:"Energy",icon:Zap},{id:"auto",name:"Auto",icon:Car},{id:"fmcg",name:"FMCG",icon:ShoppingBasket}];
export default function SectorFunds(){
 const [query,setQuery]=useState("");
 const filtered=sectors.filter(sector=>matchesSearch(query,[sector.name,sector.id==="fmcg"?"fast moving consumer goods":sector.id==="auto"?"automobile automotive":"power energy"]));
 return <div className="dashboard"><WorkspaceHeader section="sectors"/><main className="fund-main sector-main"><div className="heading"><div><h1>Sector funds</h1><p>Your selected equities, organised by sector.</p></div><SearchField id="sector-search" label="Search sectors" placeholder="Search sectors…" value={query} onChange={setQuery}/></div>{filtered.length===0&&<p className="workspace-search-empty" role="status">No matching sectors. Try Energy, Auto or FMCG.</p>}<div className="sector-grid">{filtered.map(sector=><section className={"sector-card sector-"+sector.id} key={sector.id} aria-labelledby={sector.id+"-title"}><header><span className="sector-icon"><sector.icon size={23} aria-hidden="true"/></span><h2 id={sector.id+"-title"}>{sector.name}</h2></header><div className="sector-empty"><span className="sector-empty-rule" aria-hidden="true"/><h3>No equities added yet</h3><p>Ready for your selections.</p></div></section>)}</div></main></div>;
}
