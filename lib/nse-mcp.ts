// Official, public, read-only NSE MCP endpoints. No portfolio writes or AI ranking.
export const nseSources={live:"https://mcp.nseindia.in/cmmkt/mcp",history:"https://mcp.nseindia.in/bhavcopy/cm/mcp"} as const;
type Service=keyof typeof nseSources;
type RecordValue=Record<string,unknown>;
const object=(value:unknown):RecordValue=>value!==null&&typeof value==="object"&&!Array.isArray(value)?value as RecordValue:{};
const number=(value:unknown)=>typeof value==="number"&&Number.isFinite(value)?value:null;
const positive=(value:unknown)=>{const n=number(value);return n!==null&&n>0?n:null;};
const string=(value:unknown)=>typeof value==="string"?value:null;
export const validNseSymbol=(value:string)=>/^[A-Z0-9][A-Z0-9&_.-]{0,29}$/.test(value);

// Both JSON and SSE are returned by the official servers, including SSE for
// finite responses. Stop at the matching RPC response instead of waiting for EOF.
export async function readNseRpc(response:Response,id:number):Promise<RecordValue>{
  if(!response.ok)throw new Error("NSE service returned HTTP "+response.status+".");
  if(!response.body)throw new Error("NSE returned an empty response.");
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="",bytes=0;
  const sse=response.headers.get("content-type")?.includes("text/event-stream");
  try{
    while(true){
      const chunk=await reader.read();if(chunk.done)break;
      bytes+=chunk.value.byteLength;if(bytes>1_000_000)throw new Error("NSE response exceeded the size limit.");
      buffer=(buffer+decoder.decode(chunk.value,{stream:true})).replace(/\r\n/g,"\n");
      if(sse){let boundary:number;while((boundary=buffer.indexOf("\n\n"))!==-1){const event=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);const data=event.split("\n").filter(line=>line.startsWith("data:")).map(line=>line.slice(5).trimStart()).join("\n");if(!data)continue;const message=object(JSON.parse(data));if(message.id===id)return message;}}
    }
    if(!sse){const message=object(JSON.parse(buffer));if(message.id===id)return message;}
    throw new Error("NSE did not return the expected response.");
  }finally{await reader.cancel().catch(()=>{});}
}

export function unwrapNseResult(value:unknown){
  const result=object(value);if(result.isError===true)throw new Error("NSE could not return data for this request.");
  const structured=result.structuredContent;
  const content=Array.isArray(result.content)?result.content:[];
  const text=content.map(object).filter(part=>part.type==="text"&&typeof part.text==="string").map(part=>part.text).join("\n");
  const payload=object(structured??(text?JSON.parse(text):null));
  if(payload.error||payload.isError===true)throw new Error("NSE reports that this data is unavailable.");
  return payload;
}

import companyQuotes from "../data/company-quotes.json" with { type: "json" };
import nseEquitySecurities from "../data/nse-equity-securities.json" with { type: "json" };

const knownSectors: Record<string, string> = {
  ATHERENERG: "Electric Vehicles",
  CDSL: "Capital Markets",
  RELIANCE: "Oil & Gas / Diversified",
  TCS: "IT Services",
  INFY: "IT Services",
  HDFCBANK: "Banking",
  ICICIBANK: "Banking",
  KOTAKBANK: "Banking",
  AXISBANK: "Banking",
  SBIN: "Banking",
  TATAMOTORS: "Automobiles",
  TMCV: "Automobiles",
  TMPV: "Automobiles",
  "M&M": "Automobiles",
  "BAJAJ-AUTO": "Automobiles",
  EICHERMOT: "Automobiles",
  MARUTI: "Automobiles",
  BHARTIARTL: "Telecommunications",
  ITC: "FMCG / Diversified",
  HINDUNILVR: "FMCG",
  NESTLEIND: "FMCG",
  BRITANNIA: "FMCG",
  VBL: "Consumer Beverages",
  SUNPHARMA: "Pharmaceuticals",
  CIPLA: "Pharmaceuticals",
  DRREDDY: "Pharmaceuticals",
  DIVISLAB: "Pharmaceuticals",
  APOLLOHOSP: "Healthcare",
  TATAPOWER: "Energy & Power",
  NTPC: "Energy & Power",
  POWERGRID: "Power Transmission",
  ADANIENT: "Infrastructure / Diversified",
  ADANIPORTS: "Ports & Logistics",
  ADANIGREEN: "Renewable Energy",
  TATASTEEL: "Metals & Mining",
  JSWSTEEL: "Metals & Mining",
  HINDALCO: "Metals & Mining",
  COALINDIA: "Mining",
  ULTRACEMCO: "Cement",
  AMBUJACEM: "Cement",
  ACC: "Cement",
  DLF: "Real Estate",
  GODREJPROP: "Real Estate",
  LODHA: "Real Estate",
  OBEROIRLTY: "Real Estate",
  LT: "Engineering & Construction",
  BEL: "Aerospace & Defence",
  HAL: "Aerospace & Defence",
  BDL: "Aerospace & Defence",
  DATAPATTNS: "Defence Technology",
  ZOMATO: "Internet & Consumer Tech",
  PAYTM: "Fintech",
  NYKAA: "E-Commerce",
  POLICYBZR: "Insurtech",
  BSE: "Financial Market Infrastructure",
  MCX: "Financial Market Infrastructure",
  CAMS: "Financial Infrastructure",
  ANGELONE: "Broking & Wealth",
};

export function inferSector(symbol: string, name: string): string {
  const normSym = symbol.replace(/[^A-Z0-9]/g, "");
  if (knownSectors[normSym]) return knownSectors[normSym];
  if (knownSectors[symbol]) return knownSectors[symbol];

  const n = name.toLowerCase();
  if (/\b(bank|banking)\b/.test(n)) return "Banking";
  if (/\b(finance|financial|finserv|housing finance|capital)\b/.test(n)) return "Financial Services";
  if (/\b(pharma|pharmaceutical|drugs|laboratories|lifesciences|biotech)\b/.test(n)) return "Pharmaceuticals";
  if (/\b(hospital|healthcare|health care|medicare|clinic)\b/.test(n)) return "Healthcare";
  if (/\b(software|technologies|infotech|tech|digital|solutions)\b/.test(n)) return "Information Technology";
  if (/\b(motors|automotive|automobile|auto|axles|tyres|tubes)\b/.test(n)) return "Automobiles & Auto Ancillaries";
  if (/\b(power|energy|renewables|solar|wind|hydro)\b/.test(n)) return "Energy & Power";
  if (/\b(chemical|chemicals|petrochem|fertilisers|fertilizers)\b/.test(n)) return "Chemicals";
  if (/\b(steel|metals|mining|iron|alloys|minerals)\b/.test(n)) return "Metals & Mining";
  if (/\b(cement|cements|refractories|infra|construction|buildcon)\b/.test(n)) return "Infrastructure & Materials";
  if (/\b(hotel|hotels|resorts|hospitality|leisure)\b/.test(n)) return "Hotels & Hospitality";
  if (/\b(textile|textiles|fabrics|yarn|spinning|garments|fashions)\b/.test(n)) return "Textiles & Apparel";
  if (/\b(food|foods|beverages|dairy|sugar|agro|edible)\b/.test(n)) return "FMCG & Agriculture";
  if (/\b(realty|properties|estates|developers|housing)\b/.test(n)) return "Real Estate";
  if (/\b(logistics|shipping|transport|ports|express)\b/.test(n)) return "Logistics & Shipping";
  if (/\b(defence|defense|aerospace)\b/.test(n)) return "Aerospace & Defence";

  return "Equity · NSE Main Board";
}

export async function callNse(service:Service,name:string,args:RecordValue,fetcher:typeof fetch=(input,init)=>globalThis.fetch(input,init)){
  const allowed=service==="live"?["cm_get_stock_quote"]:["search_symbols","get_bulk_quote"];
  if(!allowed.includes(name))throw new Error("Unsupported NSE data request.");
  // This budget covers initialization, notification and the quote call together.
  // NSE can take over 14 seconds for that sequence even when all steps succeed.
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45_000);
  let session:string|undefined;
  let cookie:string|undefined;
  const headers=()=>({
    "Content-Type":"application/json",
    "Accept":"application/json, text/event-stream",
    "MCP-Protocol-Version":"2025-03-26",
    ...(session?{"Mcp-Session-Id":session}:{}),
    ...(cookie?{"Cookie":cookie}:{})
  });
  const post=(body:unknown)=>fetcher(nseSources[service],{method:"POST",headers:headers(),body:JSON.stringify(body),signal:controller.signal,redirect:"manual"});
  try{
    const response=await post({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2025-03-26",capabilities:{},clientInfo:{name:"equity-fishing-reader",version:"1.0"}}});
    session=response.headers.get("mcp-session-id")??undefined;
    cookie=response.headers.get("set-cookie")??undefined;
    const initialized=await readNseRpc(response,1);if(initialized.error)throw new Error("NSE connection could not be initialized.");
    try{
      const notification=await post({jsonrpc:"2.0",method:"notifications/initialized"});
      await notification.body?.cancel();
    }catch{/* NSE MCP returns 404 for notifications/initialized */}
    const result=await readNseRpc(await post({jsonrpc:"2.0",id:2,method:"tools/call",params:{name,arguments:args}}),2);
    if(result.error)throw new Error("NSE could not complete the data request.");
    return unwrapNseResult(result.result);
  }finally{
    clearTimeout(timer);
    if(session)try{const closed=await fetcher(nseSources[service],{method:"DELETE",headers:headers(),signal:AbortSignal.timeout(1000),redirect:"manual"});await closed.body?.cancel();}catch{/* Cleanup is best effort; no retry of the data request. */}
  }
}

export async function nseCandidates(query:string){
  const clean=query.trim().toLowerCase();
  if(!clean)return [];
  const terms=clean.split(/\s+/).filter(Boolean);

  const securities=(nseEquitySecurities as unknown as {securities:[string,string,string][]})?.securities??[];
  const quotes=(companyQuotes as any)?.quotes??{};

  const scored:Array<{
    symbol:string;
    name:string;
    isin:string;
    sector:string;
    price:number|null;
    changePercent:number|null;
    close:number|null;
    date:string|null;
    score:number;
  }>=[];

  for(const [symbol,name,isin] of securities){
    const sLower=symbol.toLowerCase();
    const nLower=name.toLowerCase();
    let score=0;

    if(sLower===clean)score=1000;
    else if(nLower===clean)score=900;
    else if(sLower.startsWith(clean))score=500;
    else if(nLower.startsWith(clean))score=400;
    else if(nLower.split(/\s+/).some(w=>w.startsWith(clean)))score=300;
    else if(terms.every(t=>sLower.includes(t)||nLower.includes(t)))score=100;
    else if(isin&&isin.toLowerCase()===clean)score=800;

    if(score>0){
      const q=quotes[symbol];
      scored.push({
        symbol,
        name,
        isin,
        sector:inferSector(symbol,name),
        price:positive(q?.price),
        changePercent:number(q?.changePercent),
        close:positive(q?.previousClose??q?.price),
        date:string(q?.asOf??q?.asOfIso),
        score
      });
    }
  }

  scored.sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol));
  return scored.slice(0,15).map(({score:_,...item})=>item);
}

export function normalizeNseQuote(symbol:string,payload:unknown){
  const data=object(payload),stock=object(data.stock);
  if(stock.symbol!==symbol)throw new Error("NSE returned a different security; quote withheld.");
  if(!["EQ","BE","BZ","SM","ST"].includes(String(stock.series)))throw new Error("This NSE security is outside the supported equity series.");
  const asOf=string(stock.latestTimestamp),parsed=asOf?Date.parse(asOf.replace(" ","T")+(/(?:Z|[+-]\d\d:\d\d)$/.test(asOf)?"":"+05:30")):NaN;
  return {symbol,series:String(stock.series),price:positive(stock.lastTradedPrice),previousClose:positive(stock.preClosePrice),change:number(stock.change),changePercent:number(stock.perChange),volume:number(stock.volume),open:positive(stock.openPrice),yearHigh:positive(stock.fiftyTwoWeekHigh),yearLow:positive(stock.fiftyTwoWeekLow),change30d:number(stock.perChange30d),high:positive(stock.highPrice),low:positive(stock.lowPrice),asOf,asOfIso:Number.isFinite(parsed)?new Date(parsed).toISOString():null};
}
export function normalizeNseEod(symbol:string,payload:unknown){
  const data=object(payload),rows=Array.isArray(data.quotes)?data.quotes:[];
  const row=rows.map(object).find(row=>row.symbol===symbol);if(!row)throw new Error("NSE end-of-day data is unavailable for this security.");
  return {symbol,close:positive(row.close),volume:number(row.volume),date:string(row.date)};
}

function getCachedQuote(symbol: string) {
  try {
    return (companyQuotes as any)?.quotes?.[symbol] ?? null;
  } catch {
    return null;
  }
}

export async function nseSnapshot(symbol:string){
  const [live,eod]=await Promise.allSettled([callNse("live","cm_get_stock_quote",{symbol}).then(data=>normalizeNseQuote(symbol,data)),callNse("history","get_bulk_quote",{symbols:[symbol]}).then(data=>normalizeNseEod(symbol,data))]);
  const fallback = live.status==="rejected" ? getCachedQuote(symbol) : null;
  const liveVal = live.status==="fulfilled" ? live.value : fallback;
  return {symbol,retrievedAt:new Date().toISOString(),live:liveVal,eod:eod.status==="fulfilled"?eod.value:null,liveError:liveVal?null:(live.status==="rejected"?nseFailure(live.reason):null),eodError:eod.status==="rejected"?nseFailure(eod.reason):null};
}
export type NseSnapshot=Awaited<ReturnType<typeof nseSnapshot>>;
export type NseCandidate=Awaited<ReturnType<typeof nseCandidates>>[number];

export function nseFailure(error:unknown){
  if(error instanceof Error){
    if(error.name==="AbortError"||error.name==="TimeoutError")return "NSE connection timed out.";
    if(error.message.startsWith("NSE ")||error.message.startsWith("This NSE "))return error.message;
  }
  return "NSE connection could not be established.";
}

