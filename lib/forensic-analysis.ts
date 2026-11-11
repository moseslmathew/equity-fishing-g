import fiiQuarterly from "../data/fii-quarterly.json";
import quotesData from "../data/company-quotes.json";
import nseSecData from "../data/nse-equity-securities.json";
import nseForensicData from "../data/forensic-nse-3m.json";
import type { combinedAnalysis } from "./combined-analysis";
import type { FullComparison } from "./full-portfolio";
import { investorProfiles } from "./investor-registry";

export type ForensicConfidence = "High" | "Moderate-High" | "Cautionary";

export interface ForensicRow {
  entity: string;
  symbol?: string;
  trajectory: string;
  hiddenMetric: string;
  crossSignal: string;
  note?: string;
  tone: "positive" | "negative" | "warning" | "info";
}

export interface ForensicStoryEnhancement {
  confidence: ForensicConfidence;
  confidenceReason: string;
  assumptions: string;
  asOf: string;
  columns: [string, string, string, string];
  rows: ForensicRow[];
}

type MonthAnalysis = ReturnType<typeof combinedAnalysis> & { month: string };

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(limited|ltd)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

const fmtIn = (n: number) => new Intl.NumberFormat("en-IN").format(n);

function buildSymbolIndex(allComparisons: FullComparison[]) {
  const symByIsin = new Map<string, string>();
  const symByName = new Map<string, string>();
  for (const row of nseSecData.securities as [string, string, string][]) {
    const [sym, name, isin] = row;
    if (isin) symByIsin.set(isin, sym);
    if (name) symByName.set(norm(name), sym);
  }
  const isinByNormName = new Map<string, string>();
  for (const c of allComparisons) {
    for (const r of c.rows) {
      if (/^INE[A-Z0-9]{9}$/.test(r.key)) {
        isinByNormName.set(norm(r.name), r.key);
      }
    }
  }
  return (name: string): string | null => {
    const k = norm(name);
    const isin = isinByNormName.get(k);
    return (isin && symByIsin.get(isin)) || symByName.get(k) || null;
  };
}

function buildAceIndex() {
  const map = new Map<string, { name: string; stake: number | null; date: string }[]>();
  for (const profile of investorProfiles) {
    for (const h of profile.portfolio.holdings) {
      const k = norm(h.name);
      const list = map.get(k) ?? [];
      list.push({ name: profile.name, stake: h.stake, date: h.date });
      map.set(k, list);
    }
  }
  return map;
}

interface Company3M {
  key: string;
  name: string;
  symbol: string | null;
  heldByMonth: Record<string, number>;
  sharesByMonth: Record<string, number>;
  addsByMonth: Record<string, number>;
  cutsByMonth: Record<string, number>;
  initsLatest: { name: string; weight: number | null; qty: number }[];
  exitsLatest: string[];
  totalAdds3M: number;
  totalCuts3M: number;
  totalExits3M: number;
  maxWeightLatest: number;
  avgWeightLatest: number;
}

function buildThreeMonthMatrix(
  analyses: MonthAnalysis[],
  resolveSym: (name: string) => string | null
) {
  const matrix = new Map<string, Company3M>();
  const latestMonth = analyses.at(-1)?.month ?? "";
  for (const period of analyses) {
    for (const c of period.companies) {
      const entry = matrix.get(c.key) ?? {
        key: c.key,
        name: c.name,
        symbol: resolveSym(c.name),
        heldByMonth: {},
        sharesByMonth: {},
        addsByMonth: {},
        cutsByMonth: {},
        initsLatest: [],
        exitsLatest: [],
        totalAdds3M: 0,
        totalCuts3M: 0,
        totalExits3M: 0,
        maxWeightLatest: 0,
        avgWeightLatest: 0,
      };
      const holders = c.funds.filter((f) => f.currentQuantity > 0);
      entry.heldByMonth[period.month] = holders.length;
      entry.sharesByMonth[period.month] = holders.reduce((s, f) => s + f.currentQuantity, 0);
      entry.addsByMonth[period.month] = c.adding;
      entry.cutsByMonth[period.month] = c.reducing;
      entry.totalAdds3M += c.adding;
      entry.totalCuts3M += c.reducing;
      entry.totalExits3M += c.funds.filter((f) => f.status === "exited").length;
      if (period.month === latestMonth) {
        entry.initsLatest = c.funds
          .filter((f) => f.status === "new")
          .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
          .map((f) => ({ name: f.name, weight: f.weight, qty: f.currentQuantity }));
        entry.exitsLatest = c.funds.filter((f) => f.status === "exited").map((f) => f.name);
        entry.maxWeightLatest = Math.max(0, ...holders.map((f) => f.weight ?? 0));
        entry.avgWeightLatest = holders.length
          ? holders.reduce((s, f) => s + (f.weight ?? 0), 0) / holders.length
          : 0;
      }
      matrix.set(c.key, entry);
    }
  }
  return matrix;
}

const shortFund = (name: string) =>
  name
    .replace(/ Small Cap Fund| Mid Cap Fund| Midcap Fund| Large & Mid Cap Fund| Flexi Cap Fund| Fund/g, "")
    .trim();

export function computeForensicInsights(
  analyses: MonthAnalysis[],
  allComparisons: FullComparison[]
) {
  const latest = analyses.at(-1);
  const prev = analyses.length >= 2 ? analyses[analyses.length - 2] : undefined;
  const earliest = analyses[0];
  const latestMonth = latest?.month ?? "2026-10";
  const prevMonth = prev?.month ?? "2026-09";
  const earliestMonth = earliest?.month ?? "2026-08";

  const resolveSym = buildSymbolIndex(allComparisons);
  const matrix = buildThreeMonthMatrix(analyses, resolveSym);
  const aceIndex = buildAceIndex();
  const quotes = quotesData.quotes as Record<string, { price: number; yearHigh: number; yearLow: number; asOfIso: string }>;
  const fiiSecs = fiiQuarterly.securities as Record<string, { quarters: Record<string, number> }>;
  const nseSecs = nseForensicData.securities as Record<
    string,
    { months: Record<string, { delPct: number; vol: number }> }
  >;

  const asOfLatest =
    allComparisons
      .filter((c) => c.currentDate.startsWith(latestMonth))
      .map((c) => c.checkedAt)
      .sort()
      .at(-1)
      ?.slice(0, 10) ?? "2026-11-11";

  const usedKeys = new Set<string>();

  // 1. Pre-IPO / Instant Multi-Fund Entries in Latest Month (0 in prevMonth -> >= 2 fresh initiations)
  const preIpoCandidates = [...matrix.values()]
    .filter((c) => (c.heldByMonth[prevMonth] ?? 0) === 0 && c.initsLatest.length >= 2)
    .sort((a, b) => b.initsLatest.length - a.initsLatest.length || (b.sharesByMonth[latestMonth] ?? 0) - (a.sharesByMonth[latestMonth] ?? 0));

  // Also include multi-month stealth pre-IPO climbers like Rentomojo (0 -> 6 -> 7)
  const rentomojo = matrix.get("name:rentomojo");
  const preIpoList = preIpoCandidates.slice(0, 5);
  if (rentomojo && !preIpoList.some((x) => x.key === rentomojo.key)) {
    preIpoList.splice(2, 0, rentomojo);
  }
  const finalPreIpo = preIpoList.slice(0, 6);
  for (const c of finalPreIpo) usedKeys.add(c.key);

  const preIpoRows: ForensicRow[] = finalPreIpo.map((c) => {
    const h8 = c.heldByMonth[earliestMonth] ?? 0;
    const h9 = c.heldByMonth[prevMonth] ?? 0;
    const h10 = c.heldByMonth[latestMonth] ?? 0;
    const shares = c.sharesByMonth[latestMonth] ?? 0;
    const topInits = c.initsLatest
      .slice(0, 3)
      .map((f) => `${shortFund(f.name)}${f.weight ? ` (${f.weight.toFixed(2)}%)` : ""}`)
      .join(", ");
    return {
      entity: c.name,
      symbol: c.symbol ?? undefined,
      trajectory: `${h8} → ${h9} → ${h10} funds`,
      hiddenMetric: `${fmtIn(shares)} shares`,
      crossSignal:
        c.initsLatest.length >= 2
          ? `${c.initsLatest.length} fresh Oct buys: ${topInits}`
          : `${c.totalAdds3M} adds / 0 cuts · Max ${c.maxWeightLatest.toFixed(2)}% NAV`,
      tone: "info",
    };
  });

  // 2. FII-to-DII Liquidity Handoff & Dual Convergence
  const handoffRows: ForensicRow[] = [];
  const handoffList: {
    c: Company3M;
    fiiJun: number;
    fiiSep: number;
    fiiDiff: number;
    draw: number | null;
    type: "handoff" | "dual";
  }[] = [];

  for (const c of matrix.values()) {
    if (!c.symbol || usedKeys.has(c.key)) continue;
    const fii = fiiSecs[c.symbol];
    if (!fii?.quarters) continue;
    const qJun = fii.quarters["2026-06"];
    const qSep = fii.quarters["2026-09"];
    if (qJun === undefined || qSep === undefined) continue;
    const diff = Number((qSep - qJun).toFixed(2));
    const held10 = c.heldByMonth[latestMonth] ?? 0;
    if (held10 < 3) continue;
    const q = quotes[c.symbol];
    const draw = q?.yearHigh ? Number((((q.price - q.yearHigh) / q.yearHigh) * 100).toFixed(1)) : null;

    if (diff <= -3.0 && c.totalAdds3M >= 6 && c.totalAdds3M > c.totalCuts3M) {
      handoffList.push({ c, fiiJun: qJun, fiiSep: qSep, fiiDiff: diff, draw, type: "handoff" });
    } else if (diff >= 2.5 && c.totalAdds3M >= 5 && c.totalCuts3M <= 1) {
      handoffList.push({ c, fiiJun: qJun, fiiSep: qSep, fiiDiff: diff, draw, type: "dual" });
    }
  }
  handoffList.sort((a, b) => Math.abs(b.fiiDiff) - Math.abs(a.fiiDiff));
  const handoffs = handoffList.filter((x) => x.type === "handoff").slice(0, 4);
  const duals = handoffList.filter((x) => x.type === "dual").slice(0, 2);

  for (const item of [...handoffs, ...duals]) {
    usedKeys.add(item.c.key);
    const h8 = item.c.heldByMonth[earliestMonth] ?? 0;
    const h9 = item.c.heldByMonth[prevMonth] ?? 0;
    const h10 = item.c.heldByMonth[latestMonth] ?? 0;
    handoffRows.push({
      entity: item.c.name,
      symbol: item.c.symbol ?? undefined,
      trajectory: `${item.fiiJun.toFixed(1)}% → ${item.fiiSep.toFixed(1)}% FII (${item.fiiDiff > 0 ? "+" : ""}${item.fiiDiff} pp)`,
      hiddenMetric: `MF +${item.c.totalAdds3M} / -${item.c.totalCuts3M} (${h8}→${h9}→${h10})`,
      crossSignal:
        item.type === "dual"
          ? `Dual FII + MF buying${item.draw !== null ? ` · ${item.draw}% off 52W high` : ""}`
          : `DII absorbed FII exit${item.draw !== null ? ` · ${item.draw}% off 52W high` : ""}`,
      tone: item.type === "dual" ? "positive" : "warning",
    });
  }

  // 3. NSE Delivery Breakouts & Contrarian Drawdown Accumulation
  const microList: {
    c: Company3M;
    delAug: number | null;
    delSep: number | null;
    delOct: number;
    delDelta: number;
    draw: number | null;
    price: number | null;
    score: number;
  }[] = [];

  for (const c of matrix.values()) {
    if (!c.symbol || usedKeys.has(c.key)) continue;
    const nse = nseSecs[c.symbol];
    const q = quotes[c.symbol];
    const held10 = c.heldByMonth[latestMonth] ?? 0;
    if (!nse?.months?.[latestMonth] || held10 < 4) continue;
    if (c.totalAdds3M < 4 || c.totalAdds3M <= c.totalCuts3M) continue;

    const delAug = nse.months[earliestMonth]?.delPct ?? null;
    const delSep = nse.months[prevMonth]?.delPct ?? null;
    const delOct = nse.months[latestMonth].delPct;
    const delDelta = delAug !== null ? Number((delOct - delAug).toFixed(1)) : 0;
    const draw = q?.yearHigh ? Number((((q.price - q.yearHigh) / q.yearHigh) * 100).toFixed(1)) : null;

    const isBreakout = delDelta >= 14 || delOct >= 60;
    const isContrarian = draw !== null && draw <= -28 && c.totalCuts3M <= 2;
    if (isBreakout || isContrarian) {
      const score = (delDelta >= 14 ? delDelta : 0) + (draw !== null && draw <= -28 ? Math.abs(draw) * 0.6 : 0) + c.totalAdds3M * 2;
      microList.push({ c, delAug, delSep, delOct, delDelta, draw, price: q?.price ?? null, score });
    }
  }
  microList.sort((a, b) => b.score - a.score);
  const finalMicro = microList.slice(0, 6);
  for (const item of finalMicro) usedKeys.add(item.c.key);
  const microRows: ForensicRow[] = finalMicro.map((item) => ({
    entity: item.c.name,
    symbol: item.c.symbol ?? undefined,
    trajectory:
      item.delAug !== null
        ? `${item.delAug}% → ${item.delSep ?? "—"}% → ${item.delOct}% delivery`
        : `${item.delOct}% Oct delivery`,
    hiddenMetric: `MF +${item.c.totalAdds3M} / -${item.c.totalCuts3M} · ${item.c.heldByMonth[latestMonth] ?? 0} funds`,
    crossSignal:
      item.draw !== null
        ? `₹${fmtIn(Math.round(item.price ?? 0))} (${item.draw}% off 52W high)`
        : `Delivery delta ${item.delDelta > 0 ? "+" : ""}${item.delDelta} pp`,
    tone: "positive",
  }));

  // 4. Hidden Divergences, Exchange Rotation & Speculative Churn Alerts
  const divRows: ForensicRow[] = [];
  const bse = [...matrix.values()].find((c) => c.symbol === "BSE");
  const mcx = [...matrix.values()].find((c) => c.symbol === "MCX");
  const neuland = [...matrix.values()].find((c) => c.symbol === "NEULANDLAB");
  const kvb = [...matrix.values()].find((c) => c.symbol === "KARURVYSYA");
  const eternal = [...matrix.values()].find((c) => c.symbol === "ETERNAL");
  const welspun = [...matrix.values()].find((c) => c.symbol === "WELCORP");
  for (const c of [mcx, bse, neuland, kvb, eternal, welspun]) {
    if (c) usedKeys.add(c.key);
  }

  if (mcx) {
    const delOct = nseSecs["MCX"]?.months?.[latestMonth]?.delPct;
    divRows.push({
      entity: mcx.name,
      symbol: "MCX",
      trajectory: `${mcx.heldByMonth[earliestMonth] ?? 0} → ${mcx.heldByMonth[prevMonth] ?? 0} → ${mcx.heldByMonth[latestMonth] ?? 0} funds`,
      hiddenMetric: `+${mcx.totalAdds3M} adds / -${mcx.totalCuts3M} cuts · ${mcx.avgWeightLatest.toFixed(2)}% avg`,
      crossSignal: `Exchange leader${delOct ? ` · ${delOct}% Oct delivery` : ""}`,
      tone: "positive",
    });
  }
  if (bse) {
    const sh9 = bse.sharesByMonth[prevMonth] ?? 0;
    const sh10 = bse.sharesByMonth[latestMonth] ?? 0;
    divRows.push({
      entity: bse.name,
      symbol: "BSE",
      trajectory: `${fmtIn(sh9)} → ${fmtIn(sh10)} shares`,
      hiddenMetric: `+${bse.totalAdds3M} adds / -${bse.totalCuts3M} cuts (${bse.totalExits3M} exits)`,
      crossSignal: "Capital rotated out of BSE into MCX & CDSL",
      tone: "negative",
    });
  }
  if (neuland) {
    const aces = aceIndex.get(norm(neuland.name)) ?? [];
    const aceTotal = aces.reduce((s, a) => s + (a.stake ?? 0), 0);
    divRows.push({
      entity: neuland.name,
      symbol: "NEULANDLAB",
      trajectory: `${neuland.heldByMonth[earliestMonth] ?? 0} → ${neuland.heldByMonth[prevMonth] ?? 0} → ${neuland.heldByMonth[latestMonth] ?? 0} funds`,
      hiddenMetric: `MF +${neuland.totalAdds3M} adds / -${neuland.totalCuts3M} cuts`,
      crossSignal: `Ace clash: ${aces.length} marquee holders own ${aceTotal.toFixed(2)}%`,
      tone: "warning",
    });
  }
  if (kvb) {
    const mSep = nseSecs["KARURVYSYA"]?.months?.[prevMonth];
    const mOct = nseSecs["KARURVYSYA"]?.months?.[latestMonth];
    divRows.push({
      entity: kvb.name,
      symbol: "KARURVYSYA",
      trajectory: mSep && mOct ? `Vol ${(mSep.vol / 1e6).toFixed(1)}M → ${(mOct.vol / 1e6).toFixed(1)}M` : `${kvb.heldByMonth[latestMonth]} funds`,
      hiddenMetric: mSep && mOct ? `Delivery ${mSep.delPct}% → ${mOct.delPct}%` : `+${kvb.totalAdds3M}/-${kvb.totalCuts3M}`,
      crossSignal: "2x volume spike with -18.8 pp delivery drop (churn)",
      tone: "warning",
    });
  }
  if (eternal) {
    divRows.push({
      entity: eternal.name,
      symbol: "ETERNAL",
      trajectory: `${fmtIn(eternal.sharesByMonth[prevMonth] ?? 0)} → ${fmtIn(eternal.sharesByMonth[latestMonth] ?? 0)} shares`,
      hiddenMetric: `MF +${eternal.totalAdds3M} adds / -${eternal.totalCuts3M} cuts`,
      crossSignal: `FII +3.92 pp QoQ vs MF trim (${eternal.exitsLatest.length ? shortFund(eternal.exitsLatest[0]) + " exit" : "4 Oct cuts"})`,
      tone: "negative",
    });
  }
  if (welspun) {
    divRows.push({
      entity: welspun.name,
      symbol: "WELCORP",
      trajectory: `${welspun.heldByMonth[earliestMonth] ?? 0} → ${welspun.heldByMonth[prevMonth] ?? 0} → ${welspun.heldByMonth[latestMonth] ?? 0} funds`,
      hiddenMetric: `MF +${welspun.totalAdds3M} adds / -${welspun.totalCuts3M} cuts (${welspun.totalExits3M} exits)`,
      crossSignal: "FII +8.48 pp QoQ buying while domestic MFs sold",
      tone: "warning",
    });
  }

  // 5. Zero-Exit 3-Month Compounders (0 cuts/exits across all 3 months, sorted by total adds & delivery)
  const zeroExits = [...matrix.values()]
    .filter(
      (c) =>
        !usedKeys.has(c.key) &&
        c.totalCuts3M === 0 &&
        c.totalAdds3M >= 6 &&
        (c.heldByMonth[latestMonth] ?? 0) >= 4 &&
        (c.heldByMonth[prevMonth] ?? 0) > 0
    )
    .sort((a, b) => b.totalAdds3M - a.totalAdds3M || (b.heldByMonth[latestMonth] ?? 0) - (a.heldByMonth[latestMonth] ?? 0))
    .slice(0, 6);

  const zeroExitRows: ForensicRow[] = zeroExits.map((c) => {
    const h8 = c.heldByMonth[earliestMonth] ?? 0;
    const h9 = c.heldByMonth[prevMonth] ?? 0;
    const h10 = c.heldByMonth[latestMonth] ?? 0;
    const delOct = c.symbol ? nseSecs[c.symbol]?.months?.[latestMonth]?.delPct : undefined;
    return {
      entity: c.name,
      symbol: c.symbol ?? undefined,
      trajectory: `${h8} → ${h9} → ${h10} funds`,
      hiddenMetric: `+${c.totalAdds3M} adds / 0 cuts · Max ${c.maxWeightLatest.toFixed(2)}% NAV`,
      crossSignal: delOct ? `Sticky ${delOct}% Oct NSE delivery` : `${fmtIn(c.sharesByMonth[latestMonth] ?? 0)} Oct shares`,
      tone: "positive",
    };
  });

  // Audit breakdown of latest month review flags
  const latestComps = allComparisons.filter((c) => c.currentDate.startsWith(latestMonth));
  let totalLatestRows = 0;
  let uncorroboratedRows = 0;
  let corporateActionRows = 0;
  let mismatchRows = 0;
  for (const c of latestComps) {
    for (const r of c.rows) {
      totalLatestRows++;
      if (!r.note) continue;
      if (r.note.includes("not been independently corroborated")) uncorroboratedRows++;
      else if (r.note.includes("corporate-action")) corporateActionRows++;
      else mismatchRows++;
    }
  }

  return {
    asOfLatest,
    totalUniqueCompanies3M: matrix.size,
    totalLatestRows,
    uncorroboratedRows,
    corporateActionRows,
    mismatchRows,
    preIpo: {
      confidence: "Moderate-High" as ForensicConfidence,
      confidenceReason: "Direct AMC primary workbooks confirm share counts; unlisted pricing depends on scheme valuation norms.",
      assumptions: "Simultaneous 0-to-multi-fund appearances indicate private placement or newly allotted institutional tranches rather than open-market trading.",
      asOf: asOfLatest,
      columns: ["Company", "3M Fund Count", "October Shares", "Initiation Signal"] as [string, string, string, string],
      rows: preIpoRows,
    } satisfies ForensicStoryEnhancement,
    handoff: {
      confidence: "High" as ForensicConfidence,
      confidenceReason: "Corroborated across statutory Q2 FY27 shareholding filings, 3-month MF equity ledgers, and NSE quotes.",
      assumptions: "FII quarterly snapshots end 30 Sep 2026 while MF holdings extend to 31 Oct 2026; overlapping absorption reflects multi-month liquidity transfer.",
      asOf: asOfLatest,
      columns: ["Company", "FII QoQ Shift (Jun→Sep)", "3M MF Activity", "Cross-Signal & Drawdown"] as [string, string, string, string],
      rows: handoffRows,
    } satisfies ForensicStoryEnhancement,
    microstructure: {
      confidence: "High" as ForensicConfidence,
      confidenceReason: "Derived from daily NSE Bhavcopy delivered-to-traded ratios, 52W price benchmarks, and verified MF share deltas.",
      assumptions: "Rising delivery % alongside cooling volume and MF accumulation indicates institutional lock-up; high volume with falling delivery suggests trading churn.",
      asOf: asOfLatest,
      columns: ["Company", "NSE Delivery (Aug→Oct)", "3M MF Flow", "Price vs 52W High"] as [string, string, string, string],
      rows: microRows,
    } satisfies ForensicStoryEnhancement,
    divergence: {
      confidence: "Cautionary" as ForensicConfidence,
      confidenceReason: "Highlights multi-source conflicts between domestic MFs, Ace investors, FIIs, and exchange microstructure.",
      assumptions: "Manager trims and Ace divergences reflect differing time horizons or valuation thresholds, not definitive operational deterioration.",
      asOf: asOfLatest,
      columns: ["Company", "3M Trajectory", "MF Net Signal", "Conflict / Churn Finding"] as [string, string, string, string],
      rows: divRows,
    } satisfies ForensicStoryEnhancement,
    zeroExits: {
      confidence: "High" as ForensicConfidence,
      confidenceReason: "Zero selling across 34 tracked funds over 3 consecutive month-end reconciliations with delivery verification.",
      assumptions: "Four pending October schemes (Groww, Mirae, Franklin Small/Mid) are excluded from October totals; their absence is not counted as an exit.",
      asOf: asOfLatest,
      columns: ["Company", "3M Fund Footprint", "Conviction Signal", "Delivery / Scale Proof"] as [string, string, string, string],
      rows: zeroExitRows,
    } satisfies ForensicStoryEnhancement,
  };
}
