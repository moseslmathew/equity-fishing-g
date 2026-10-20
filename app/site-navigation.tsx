"use client";
import {useState} from "react";
import {Menu,BarChart3,Users,Layers3,Globe2,ArrowRight,Check,X} from "lucide-react";
import {Dialog,DialogClose,DialogContent,DialogTitle,DialogDescription} from "../components/ui/dialog";
export type WorkspaceSection="funds"|"investors"|"foreign"|"sectors";
export default function SiteNavigation({section,onNavigate}:{section:WorkspaceSection;onNavigate?:(section:"funds"|"investors")=>void}){
 const [open,setOpen]=useState(false);
 return <><button className="quiet-button menu-button" aria-label="Open navigation" aria-expanded={open} onClick={()=>setOpen(true)}><Menu size={21}/></button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="site-menu" showCloseButton={false}>
  <header className="workspace-menu-header"><span className="workspace-menu-eyebrow">YOUR RESEARCH WORKSPACE</span><DialogTitle>Explore</DialogTitle><DialogDescription>Where would you like to go?</DialogDescription><DialogClose className="workspace-menu-close" aria-label="Close navigation"><X size={19}/></DialogClose></header>
  <nav aria-label="Main navigation">{([{id:"funds",label:"Mutual funds",description:"Equity holdings, portfolio changes & research",icon:BarChart3},{id:"investors",label:"Ace investors",description:"Explore leading investors’ portfolios",icon:Users},{id:"foreign",label:"Foreign investors",description:"Blackstone · Investments, activity & strategy",icon:Globe2},{id:"sectors",label:"Sector funds",description:"Energy, Auto & FMCG",icon:Layers3}] as const).map(item=><button key={item.id} className={section===item.id?"active":""} aria-current={section===item.id?"page":undefined} onClick={()=>{setOpen(false);if(item.id==="foreign"){window.location.assign("/foreign-investors");}else if(item.id==="sectors"){window.location.assign("/sectors");}else if(onNavigate){onNavigate(item.id);}else{window.location.assign(item.id==="investors"?"/#investors":"/");}}}><span className="workspace-menu-icon"><item.icon size={22}/></span><span className="workspace-menu-copy"><strong>{item.label}</strong><span>{item.description}</span></span><span className="workspace-menu-direction" aria-hidden="true">{section===item.id?<Check size={18}/>:<ArrowRight size={18}/>}</span></button>)}</nav>
 </DialogContent></Dialog></>;
}
