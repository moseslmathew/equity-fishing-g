import fs from "node:fs";
import { fundCatalog, schemeAliases } from "../lib/fund-catalog.ts";

const AMFI_URL = "https://www.amfiindia.com/spages/NAVAll.txt";

const customMatchers = {
  invesco: ["Invesco India Small Cap Fund"],
  "uti-mid": ["UTI - Mid Cap Fund", "UTI Mid Cap Fund"],
  "kotak-mid": ["Kotak Mid Cap Fund", "Kotak Emerging Equity"],
};

async function fetchAmfiNavs() {
  console.log("Fetching AMFI NAV file...");
  const res = await fetch(AMFI_URL, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from AMFI`);
  const text = await res.text();
  const lines = text.split(/\r?\n/);

  console.log(`Downloaded ${lines.length} lines from AMFI.`);

  const results = {};
  const checkedAt = new Date().toISOString();

  for (const fund of fundCatalog) {
    const terms = [
      fund.name,
      ...(schemeAliases[fund.id] || []),
      ...(customMatchers[fund.id] || []),
    ].map((s) => s.toLowerCase());

    let bestMatch = null;

    for (const line of lines) {
      if (!line.includes(";")) continue;
      const parts = line.split(";").map((p) => p.trim());
      if (parts.length < 8) continue;
      const [code, isin, isinDiv, name, plan, option, nav, date] = parts;
      const isDirect = plan.toLowerCase().includes("direct") || name.toLowerCase().includes("direct");
      const isGrowth = option.toLowerCase().includes("growth") || name.toLowerCase().includes("growth");

      if (isDirect && isGrowth) {
        const matchesTerm = terms.some((term) => name.toLowerCase().includes(term));
        if (matchesTerm) {
          bestMatch = {
            fundId: fund.id,
            catalogName: fund.name,
            schemeCode: code,
            isinGrowth: isin,
            amfiSchemeName: name,
            plan,
            option,
            nav: parseFloat(nav),
            navDate: date,
            checkedAt,
          };
          break;
        }
      }
    }

    if (bestMatch) {
      results[fund.id] = bestMatch;
      console.log(`✓ ${fund.id.padEnd(18)}: ₹${bestMatch.nav} (${bestMatch.navDate})`);
    } else {
      console.warn(`✗ ${fund.id.padEnd(18)}: No match found!`);
    }
  }

  const matchedCount = Object.keys(results).length;
  console.log(`\nMatched ${matchedCount} / ${fundCatalog.length} mutual funds.`);

  const outputPayload = {
    checkedAt,
    source: AMFI_URL,
    totalFunds: fundCatalog.length,
    matchedFunds: matchedCount,
    navs: results,
  };

  fs.writeFileSync("data/amfi-latest-navs.json", JSON.stringify(outputPayload, null, 2) + "\n");
  console.log("Saved to data/amfi-latest-navs.json");
}

fetchAmfiNavs().catch((e) => {
  console.error("AMFI fetch error:", e);
  process.exit(1);
});
