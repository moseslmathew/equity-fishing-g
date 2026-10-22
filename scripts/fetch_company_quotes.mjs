import fs from "node:fs";
import path from "node:path";

// Load NSE securities
const directory = JSON.parse(fs.readFileSync("data/nse-equity-securities.json", "utf8"));
const isinToSymbol = new Map();
const nameToSymbol = new Map();

function cleanName(n) {
  return n.toLowerCase()
    .replace(/\b(limited|ltd|india|industries|ind|technologies|tech|solutions|enterprises|holdings|services)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

for (const [sym, name, isin] of directory.securities) {
  if (isin) isinToSymbol.set(isin, sym);
  const clean = cleanName(name);
  if (clean && !nameToSymbol.has(clean)) {
    nameToSymbol.set(clean, sym);
  }
}

function resolveSymbol(companyName, isin) {
  if (isin && isinToSymbol.has(isin)) return isinToSymbol.get(isin);
  const clean = cleanName(companyName);
  if (nameToSymbol.has(clean)) return nameToSymbol.get(clean);
  // Direct check
  const upper = companyName.toUpperCase().replace(/[^A-Z0-9]/g, "");
  for (const [sym] of directory.securities) {
    if (sym === upper) return sym;
  }
  return null;
}

const symbols = new Set();

// 1. AI Research
const agent = JSON.parse(fs.readFileSync("data/agent-research.json", "utf8"));
agent.stocks.forEach((s) => symbols.add(s.symbol));

// 2. Ace Investors
const aceFiles = [
  "ace-investors.json", "ashish-kacholia.json", "mukul-agrawal.json", "malabar-investments.json",
  "nalanda-capital.json", "abakkus.json", "anil-kumar-goel.json", "dolly-khanna.json",
  "porinju-veliyath.json", "ashish-dhawan.json", "nemish-shah.json", "mohnish-pabrai.json"
];
for (const f of aceFiles) {
  const p = JSON.parse(fs.readFileSync(path.join("data", f), "utf8"));
  for (const h of p.holdings) {
    const sym = resolveSymbol(h.name, h.key?.startsWith("INE") ? h.key : undefined);
    if (sym) symbols.add(sym);
  }
}

// 3. Top holdings from funds
const sep = JSON.parse(fs.readFileSync("data/september-portfolios.json", "utf8"));
for (const f of sep.funds) {
  for (const h of f.holdings.slice(0, 15)) {
    const sym = resolveSymbol(h.name, h.key?.startsWith("INE") ? h.key : undefined);
    if (sym) symbols.add(sym);
  }
}

const exp = JSON.parse(fs.readFileSync("data/fund-expansion-2026-10.json", "utf8"));
for (const f of exp.funds) {
  for (const h of f.holdings.slice(0, 15)) {
    const sym = resolveSymbol(h.name, h.key?.startsWith("INE") ? h.key : undefined);
    if (sym) symbols.add(sym);
  }
}

console.log(`Identified ${symbols.size} unique company tickers across funds, investors & research.`);

async function fetchQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const meta = data.chart?.result?.[0]?.meta;
  if (!meta || !meta.regularMarketPrice) throw new Error("Missing quote meta");

  const price = meta.regularMarketPrice;
  const previousClose = meta.previousClose || meta.chartPreviousClose;
  const change = previousClose ? Number((price - previousClose).toFixed(2)) : null;
  const changePercent = previousClose ? Number(((change / previousClose) * 100).toFixed(2)) : null;
  const asOf = new Date(meta.regularMarketTime * 1000).toISOString();

  return {
    symbol,
    series: "EQ",
    price,
    previousClose,
    change,
    changePercent,
    volume: meta.regularMarketVolume || 0,
    open: meta.regularMarketOpen || null,
    high: meta.regularMarketDayHigh || null,
    low: meta.regularMarketDayLow || null,
    yearHigh: meta.fiftyTwoWeekHigh || null,
    yearLow: meta.fiftyTwoWeekLow || null,
    asOf,
    asOfIso: asOf,
  };
}

async function fetchAllQuotes() {
  const list = [...symbols];
  const quotes = {};
  const batchSize = 10;
  let successCount = 0;

  for (let i = 0; i < list.length; i += batchSize) {
    const batch = list.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (sym) => {
        try {
          const q = await fetchQuote(sym);
          quotes[sym] = q;
          successCount++;
        } catch (e) {
          // Try BSE or leave note
        }
      })
    );
  }

  console.log(`Successfully fetched quotes for ${successCount} / ${list.length} companies.`);

  const payload = {
    checkedAt: new Date().toISOString(),
    count: successCount,
    quotes,
  };

  fs.writeFileSync("data/company-quotes.json", JSON.stringify(payload, null, 2) + "\n");
  console.log("Saved to data/company-quotes.json");
}

fetchAllQuotes().catch((e) => {
  console.error("Quote fetch error:", e);
  process.exit(1);
});
