const compact=(value:string)=>value.normalize("NFKD").replace(/\p{M}/gu,"").toLocaleLowerCase("en-IN").replace(/[^\p{L}\p{N}]/gu,"");
export function matchesSearch(query:string,values:string[]){
 const terms=query.trim().split(/\s+/).map(compact).filter(Boolean),text=values.map(compact).join(" ");
 return terms.every(term=>text.includes(term));
}
