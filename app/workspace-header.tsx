"use client";
import {BarChart3} from "lucide-react";
import SiteNavigation,{type WorkspaceSection} from "./site-navigation";
export default function WorkspaceHeader({section,onNavigate}:{section:WorkspaceSection;onNavigate?:(section:"funds"|"investors")=>void}){
 return <header className="site-header"><a className="site-brand" href="/"><span className="brand-mark"><BarChart3 size={20}/></span>Smallcap<span className="header-sub">Observatory</span></a><div className="header-actions"><SiteNavigation section={section} onNavigate={onNavigate}/><button className="quiet-button" onClick={async()=>{const r=await fetch("/api/logout",{method:"POST"});if(r.ok)window.location.replace("/");}}>Sign out</button></div></header>;
}
