import {fundCatalog} from "./fund-catalog";
export type Holding = { key: string; name: string; weight: number };
export type Source = { label: string; url: string; type: "official" | "third_party"; portfolioDate: string; matched: boolean };
export type Fund = { id: string; name: string; monogram: string; color: string; verification: "official_match" | "official_only" | "provider_match" | "provider_only" | "conflict"; checkStatus: "checked" | "no_new" | "failed" | "conflict"; portfolioDate: string; lastCheckedAt: string; holdings: Holding[]; sources: Source[]; notes: string[]; holdingsEvidence?:{basis:"saved_full_portfolio"|"published_allocations";checkedAt:string;sources:{label:string;url:string;scope:string}[]} };
export type Run = { at: string; summary: string; changes: string[]; status: string };
export type Portfolio = { version: number; checkedAt: string; updatedAt: string; schedule: {enabled: boolean; time: string; timezone: string; note?: string}; summary: string; funds: Fund[]; runs: Run[] };
export const ids = fundCatalog.map(f=>f.id);
export function validatePortfolio(value: unknown): asserts value is Portfolio {
  const p = value as Portfolio;
  if (!p || p.version !== 1 || !Array.isArray(p.funds) || p.funds.length !== ids.length || !Number.isFinite(Date.parse(p.checkedAt)) || typeof p.summary !== "string" || p.summary.length > 2000) throw new Error("Invalid snapshot.");
  if (!p.schedule || typeof p.schedule.enabled !== "boolean" || p.schedule.time !== "08:00" || p.schedule.timezone !== "Asia/Kolkata") throw new Error("Invalid schedule.");
  const seen = new Set<string>();
  for (const f of p.funds) {
    if (!ids.includes(f.id) || seen.has(f.id)) throw new Error("Fund snapshot must contain every scheme in the current catalog.");
    seen.add(f.id);
    if (typeof f.name !== "string" || !/^#[a-f0-9]{6}$/i.test(f.color) || typeof f.monogram !== "string" || !["official_match","official_only","provider_match","provider_only","conflict"].includes(f.verification) || !["checked","no_new","failed","conflict"].includes(f.checkStatus) || !/^\d{4}-\d{2}-\d{2}$/.test(f.portfolioDate) || !Number.isFinite(Date.parse(f.lastCheckedAt))) throw new Error("Invalid fund metadata.");
    if (!Array.isArray(f.holdings) || ![15,30].includes(f.holdings.length) || !Array.isArray(f.sources) || f.sources.length < 2 || !Array.isArray(f.notes) || f.notes.some(n => typeof n !== "string")) throw new Error("Fifteen legacy holdings or thirty holdings and at least two evidence sources are required.");
    if(f.holdingsEvidence&&(!["saved_full_portfolio","published_allocations"].includes(f.holdingsEvidence.basis)||!Number.isFinite(Date.parse(f.holdingsEvidence.checkedAt))||!Array.isArray(f.holdingsEvidence.sources)||f.holdingsEvidence.sources.length<2||f.holdingsEvidence.sources.some(s=>typeof s.label!=="string"||typeof s.scope!=="string"||new URL(s.url).protocol!=="https:")))throw new Error("Invalid extended holdings evidence.");
    const keys = new Set<string>();
    for (const h of f.holdings) {
      if (typeof h.key !== "string" || keys.has(h.key) || typeof h.name !== "string" || !h.name.trim() || !Number.isFinite(h.weight) || h.weight < 0 || h.weight > 100) throw new Error("Invalid holding.");
      keys.add(h.key);
    }
    if (f.holdings.reduce((s,h)=>s+h.weight,0)>100.01 || f.holdings.some((h,i)=>i>0 && h.weight>f.holdings[i-1].weight)) throw new Error("Holdings must be sorted by allocation.");
    for (const s of f.sources) {
      if (typeof s.label !== "string" || !["official","third_party"].includes(s.type) || typeof s.matched !== "boolean" || !/^\d{4}-\d{2}-\d{2}$/.test(s.portfolioDate) || new URL(s.url).protocol !== "https:") throw new Error("Invalid source.");
    }
    const matched = f.sources.filter(s=>s.matched && s.portfolioDate===f.portfolioDate);
    if (f.verification !== "conflict" && f.verification !== "official_only" && f.verification !== "provider_only" && matched.length<2) throw new Error("Matching sources must use the same reporting date.");
    if ((f.verification==="official_match"||f.verification==="official_only") && !matched.some(s=>s.type==="official")) throw new Error("Official confirmation needs an official source.");
  }
}
export function changesBetween(old: Portfolio, next: Portfolio) {
  const changes: string[] = [];
  for (const f of next.funds) {
    const prev = old.funds.find(x=>x.id===f.id);
    if (!prev) continue;
    if (prev.portfolioDate !== f.portfolioDate) changes.push(f.name + ": portfolio date updated to " + f.portfolioDate + ".");
    for (const h of f.holdings) {
      const before = prev.holdings.find(x=>x.key===h.key);
      if (!before){if(prev.holdings.length===f.holdings.length)changes.push(f.name + ": " + h.name + " entered the top "+f.holdings.length+" (" + h.weight.toFixed(2) + "%).");}
      else if (before.weight!==h.weight) changes.push(f.name + ": " + h.name + " allocation " + before.weight.toFixed(2) + "% → " + h.weight.toFixed(2) + "%.");
    }
    for (const h of prev.holdings) if (prev.holdings.length===f.holdings.length&&!f.holdings.some(x=>x.key===h.key)) changes.push(f.name + ": " + h.name + " left the top "+f.holdings.length+".");
  }
  return changes;
}
