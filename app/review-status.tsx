"use client";
import {useState} from "react";
import {Tooltip,TooltipContent,TooltipProvider,TooltipTrigger} from "../components/ui/tooltip";
export default function ReviewStatus({reasons}:{reasons:string[]}){
 const [open,setOpen]=useState(false);
 const unique=[...new Set(reasons.filter(Boolean))];
 return <TooltipProvider delayDuration={150}><Tooltip open={open} onOpenChange={setOpen}><TooltipTrigger asChild><button type="button" className="movement-label review review-status-trigger" onClick={()=>setOpen(value=>!value)}>Needs review</button></TooltipTrigger><TooltipContent className="review-status-tooltip" side="top" align="start" sideOffset={8} collisionPadding={16} hideArrow><strong>Why this needs review</strong>{unique.length?<ul>{unique.map(reason=><li key={reason}>{reason}</li>)}</ul>:<p>The available records do not support a reliable share-change classification.</p>}</TooltipContent></Tooltip></TooltipProvider>;
}
