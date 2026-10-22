import {companyKey} from "./top-holdings";

type Security={name:string;key?:string};
const normalized=(name:string)=>companyKey(name.replace(/\bCo\.?\b/gi,"Company "));

// Bridge exact disclosed names through their ISINs; never use fuzzy matching.
export function companyIdentity(records:Security[]){
  const parent=new Map<string,string>();
  const root=(value:string):string=>{const p=parent.get(value);if(!p){parent.set(value,value);return value;}if(p!==value)parent.set(value,root(p));return parent.get(value)!;};
  for(const row of records){const name="name:"+normalized(row.name);root(name);if(/^INE[A-Z0-9]{9}$/i.test(row.key??""))parent.set(root("isin:"+row.key!.toUpperCase()),root(name));}
  const groups=new Map<string,{name:string;aliases:Set<string>}>();
  for(const row of records){const id=root("name:"+normalized(row.name)),group=groups.get(id)??{name:row.name.replace(/\*+$/g,""),aliases:new Set<string>()};group.aliases.add(row.name);groups.set(id,group);}
  return (row:Security)=>{const id=root("name:"+normalized(row.name)),group=groups.get(id);return {id,name:group?.name??row.name,aliases:[...(group?.aliases??[row.name])]};};
}
