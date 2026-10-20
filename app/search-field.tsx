"use client";
import {Search,X} from "lucide-react";
export default function SearchField({id,label,placeholder,value,onChange}:{id:string;label:string;placeholder:string;value:string;onChange:(value:string)=>void}){
 return <div className="workspace-search"><label className="sr-only" htmlFor={id}>{label}</label><Search size={17} aria-hidden="true"/><input id={id} type="search" value={value} placeholder={placeholder} autoComplete="off" onChange={e=>onChange(e.target.value)}/>{value&&<button type="button" aria-label={"Clear "+label.toLowerCase()} onClick={()=>{onChange("");document.getElementById(id)?.focus();}}><X size={16} aria-hidden="true"/></button>}</div>;
}
