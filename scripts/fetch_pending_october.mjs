import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

function scheme(html) {
  let found;
  function walk(o) {
    if (!o || typeof o !== "object") return;
    if (o.scheme?.periods) found = o.scheme;
    for (const v of Object.values(o)) walk(v);
  }
  for (const m of html.matchAll(/self\.__next_f\.push\((.*?)\)<\/script>/gs)) {
    try {
      const s = JSON.parse(m[1])[1];
      if (typeof s === "string" && s.includes('"scheme"')) walk(JSON.parse(s.slice(s.indexOf(":") + 1)));
    } catch {}
  }
  return found;
}

const norm = (s) =>
  s
    .toLowerCase()
    .replace(/\b(limited|ltd)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

const equity = (h) =>
  /^INE[A-Z0-9]{9}$/.test(h.isin || h.key) &&
  !/future|option|\bETF\b|\bREIT\b|\bInvIT\b|debenture/i.test(h.name);

const seed = JSON.parse(fs.readFileSync("data/seed.json", "utf8"));
const expansion = JSON.parse(fs.readFileSync("data/fund-expansion-2026-10.json", "utf8"));
const september = JSON.parse(fs.readFileSync("data/september-portfolios.json", "utf8"));
const fullSeed = JSON.parse(fs.readFileSync("data/full-portfolio-seed.json", "utf8"));
const october = JSON.parse(fs.readFileSync("data/october-portfolios.json", "utf8"));

const base = [...seed.funds, ...expansion.funds.filter((f) => f.portfolioDate === "2026-09-30")];
const previousAll = [...fullSeed, ...september.comparisons, ...expansion.comparisons].filter(
  (c) => c.currentDate === "2026-09-30"
);

const pendingConfigs = [
  {
    id: "groww",
    decryptUrl: "https://decryptmutualfunds.com/fund-houses/groww/small-cap-fund",
    trackerUrl: "https://fundtrackerindia.com/scheme/groww-small-cap-fund",
  },
  {
    id: "mirae",
    decryptUrl: "https://decryptmutualfunds.com/fund-houses/mirae-asset/small-cap-fund",
    trackerUrl: "https://fundtrackerindia.com/scheme/mirae-asset-small-cap-fund",
  },
  {
    id: "franklin-small",
    decryptUrl: "https://decryptmutualfunds.com/fund-houses/franklin-templeton/small-cap-fund",
    trackerUrl: "https://fundtrackerindia.com/scheme/franklin-india-small-cap-fund",
  },
  {
    id: "franklin-mid",
    decryptUrl: "https://decryptmutualfunds.com/fund-houses/franklin-templeton/mid-cap-fund",
    trackerUrl: "https://fundtrackerindia.com/scheme/franklin-india-mid-cap-fund",
  },
];

async function main() {
  const now = new Date().toISOString();
  const newFunds = [];
  const newComparisons = [];

  for (const cfg of pendingConfigs) {
    console.log(`Fetching ${cfg.id}...`);
    const f = base.find((f) => f.id === cfg.id);
    assert(f, "Fund not found in base: " + cfg.id);

    const dRes = await fetch(cfg.decryptUrl, { signal: AbortSignal.timeout(30000) });
    if (!dRes.ok) throw new Error(`HTTP ${dRes.status} for ${cfg.decryptUrl}`);
    const dHtml = await dRes.text();
    const s = scheme(dHtml);
    const p = s?.periods?.find((p) => p.period === "2026-10-31");
    assert(p, "October period not found for " + cfg.id);
    assert.equal(p.period, "2026-10-31");
    assert.equal(p.prevPeriod, "2026-09-30");

    const tRes = await fetch(cfg.trackerUrl, { signal: AbortSignal.timeout(30000) });
    const tHtml = tRes.ok ? await tRes.text() : "";
    const trackerOctober = /portfolio holdings, Oct 2026:/.test(tHtml);
    const trackerRows = [...tHtml.matchAll(/<tr\s+data-sym="([^"]*)"\s+data-q="([^"]*)"\s+data-v="([^"]*)"\s+data-p="([^"]*)"[^>]*>(.*?)<\/tr>/gs)].map((m) => ({
      symbol: m[1],
      quantity: Number(m[2]),
      weight: Number(m[4]) * 100,
      name: (m[5].match(/class="co"[^>]*>\s*<a[^>]*>([^<]*)<\/a>/) || [])[1] ?? "",
    }));

    const raw = p.holdings
      .filter(equity)
      .filter((h) => h.quantity > 0)
      .map((h) => ({
        key: h.isin,
        isin: h.isin,
        name: h.name,
        quantity: h.quantity,
        weight: Number((h.pctNav * 100).toFixed(8)),
      }));

    const current = new Map(raw.filter((h) => h.quantity > 0).map((h) => [h.key, h]));
    assert.equal(current.size, raw.length);
    assert(current.size >= 30);
    for (const h of current.values()) {
      assert(Number.isSafeInteger(h.quantity) && h.quantity > 0);
      assert(Number.isFinite(h.weight) && h.weight >= 0 && h.weight <= 100);
    }
    const sumWeight = [...current.values()].reduce((s, h) => s + h.weight, 0);
    assert(sumWeight <= 100.1);

    const priorComparison = previousAll.find((c) => c.fundId === f.id);
    const previous = new Map(
      priorComparison?.rows.filter((h) => h.currentQuantity > 0).map((h) => [h.key, h]) ?? []
    );
    const providerMap = new Map(p.holdings.filter(equity).map((h) => [h.isin, h]));

    const crosschecks = [];
    const conflicts = [];
    for (const h of current.values()) {
      const second = trackerOctober ? trackerRows.filter((t) => norm(t.name) === norm(h.name)) : [];
      if (second?.length === 1) {
        if (second[0].quantity === h.quantity && Math.abs(second[0].weight - h.weight) <= 0.05) {
          crosschecks.push(h.key);
        } else {
          conflicts.push(h.key);
        }
      }
    }

    const top = [...current.values()]
      .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name))
      .slice(0, 30);
    const matched = top.every((h) => crosschecks.includes(h.key));
    const primarySource = {
      label: "DecryptMutualFunds · October 2026",
      url: cfg.decryptUrl,
      type: "third_party",
      portfolioDate: "2026-10-31",
      matched: true,
    };
    const second =
      trackerOctober && trackerRows.length
        ? {
            label: "Fund Tracker India · October 2026",
            url: cfg.trackerUrl,
            type: "third_party",
            portfolioDate: "2026-10-31",
            matched,
          }
        : { ...f.sources[0], label: "Historical source · " + f.portfolioDate, matched: false };

    const sources = [primarySource, second];
    const comparisonSources = [
      {
        label: primarySource.label,
        url: primarySource.url,
        scope: "October provider quantities and allocations; original AMC workbook not retrieved.",
      },
      ...(priorComparison?.sources ??
        f.sources.map((s) => ({
          label: s.label,
          url: s.url,
          scope: "Historical September allocation evidence; not October corroboration.",
        }))),
      ...(trackerOctober && trackerRows.length
        ? [
            {
              label: second.label,
              url: second.url,
              scope: `October cross-check: ${crosschecks.length} exact company quantities and allocations matched; ${conflicts.length} disagreements. This page may cover only a subset of equities.`,
            },
          ]
        : []),
    ];

    const notes = [
      "October provider disclosure. Original AMC workbook validation is pending; this is not official confirmation.",
      `${crosschecks.length} company quantities and allocations corroborated against a second October source; ${conflicts.length} disagree. Top-30 coverage ${
        matched ? "fully matched" : "not fully independently matched"
      }.`,
      "Changes are net month-end quantities; transaction timing and manager intent are unknown. Unresolved source or identifier differences are withheld from movement classifications.",
    ];

    const rowKeys = new Set([...current.keys(), ...previous.keys(), ...providerMap.keys()]);
    const rows = [];
    for (const key of rowKeys) {
      const h = current.get(key);
      const old = previous.get(key);
      const provider = providerMap.get(key);
      if (!h && !old && !provider?.qtyPrev) continue;

      let prev = old?.currentQuantity ?? provider?.qtyPrev ?? (previous.size ? 0 : null);
      let note = null;

      if (prev === null) note = "A complete September equity quantity snapshot is unavailable; direction withheld.";
      if (provider && old && provider.qtyPrev !== undefined && provider.qtyPrev !== old.currentQuantity)
        note = "Prior quantity differs between the saved September disclosure and the October provider; direction withheld pending reconciliation.";
      if (conflicts.includes(key))
        note = "October quantities or allocation disagree across sources; original AMC values are retained where available, direction withheld.";
      if (h && !crosschecks.includes(key))
        note = note ?? "October quantity has not been independently corroborated; direction withheld.";
      if (!h && provider?.quantity !== 0)
        note = note ?? "Security absent from the complete October provider list; exit withheld pending identifier / corporate-action reconciliation.";
      if (h && old && old.currentQuantity > 0) {
        const ratio = h.quantity / old.currentQuantity;
        if (ratio >= 1.9 || ratio <= 0.51)
          note = note ?? "Large quantity change: corporate-action / capital-change review required before attributing activity.";
      }
      if (!h && prev === 0) continue;

      rows.push({
        key,
        name: (h ?? old ?? provider).name,
        previousQuantity: prev,
        currentQuantity: h?.quantity ?? 0,
        weight: h?.weight ?? 0,
        previousWeight:
          old?.weight ?? (provider?.pctNavPrev !== undefined ? Number((provider.pctNavPrev * 100).toFixed(8)) : null),
        note,
      });
    }

    const c = {
      fundId: f.id,
      currentDate: "2026-10-31",
      previousDate: "2026-09-30",
      checkedAt: now,
      scope: "full_equity",
      basis: "provider_quantity_comparison",
      rows,
      sources: [...new Map(comparisonSources.map((s) => [s.url, s])).values()],
      notes,
    };

    const fundObj = {
      ...f,
      portfolioDate: "2026-10-31",
      lastCheckedAt: now,
      verification: matched ? "provider_match" : "provider_only",
      checkStatus: "checked",
      holdings: top.map((h) => ({ key: h.key, name: h.name, weight: h.weight })),
      sources,
      notes,
    };
    delete fundObj.holdingsEvidence;

    newFunds.push(fundObj);
    newComparisons.push(c);
    console.log(
      `✓ ${cfg.id}: ${fundObj.holdings.length} top holdings, ${c.rows.length} comparison rows, ${crosschecks.length} crosschecked.`
    );
  }

  // Update october-portfolios.json
  const updatedFunds = [...october.funds.filter((f) => !newFunds.some((nf) => nf.id === f.id)), ...newFunds];
  const updatedComparisons = [
    ...october.comparisons.filter((c) => !newComparisons.some((nc) => nc.fundId === c.fundId)),
    ...newComparisons,
  ];

  // Sort funds by catalog order
  const fundOrder = base.map((f) => f.id);
  updatedFunds.sort((a, b) => fundOrder.indexOf(a.id) - fundOrder.indexOf(b.id));
  updatedComparisons.sort((a, b) => fundOrder.indexOf(a.fundId) - fundOrder.indexOf(b.fundId));

  const updatedOctober = {
    ...october,
    checkedAt: now,
    funds: updatedFunds,
    comparisons: updatedComparisons,
    pending: [],
  };

  fs.writeFileSync("data/october-portfolios.json", JSON.stringify(updatedOctober, null, 2) + "\n");
  console.log(
    `data/october-portfolios.json updated successfully: ${updatedFunds.length} funds, ${updatedComparisons.length} comparisons, pending: 0.`
  );
}

main().catch((e) => {
  console.error("Error in fetch_pending_october:", e);
  process.exit(1);
});
