import fs from "node:fs";
import path from "node:path";

const newDates = ["2026-10-20", "2026-10-21"];
const month = "2026-10";
const dir = path.join("public", "nse-volume", month);
const names = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function url(date) {
  return (
    "https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_" +
    date.slice(8, 10) +
    date.slice(5, 7) +
    date.slice(0, 4) +
    ".csv"
  );
}

async function fetchDay(date) {
  console.log(`Fetching NSE Bhavcopy for ${date}...`);
  const res = await fetch(url(date), {
    signal: AbortSignal.timeout(30000),
    redirect: "manual",
  });
  if (res.status === 404) {
    console.log(`Date ${date} returned 404 (holiday or weekend)`);
    return null;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${date}`);
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift().replace(/^\uFEFF/, "").split(",").map((s) => s.trim());
  const index = (k) => header.indexOf(k);
  const dateIndex = index("DATE1");
  const symbolIndex = index("SYMBOL");
  const seriesIndex = index("SERIES");
  const volumeIndex = index("TTL_TRD_QNTY");
  const deliveryIndex = index("DELIV_QTY");

  const records = new Map();
  for (const line of lines) {
    const a = line.split(",").map((s) => s.trim());
    const stamp = a[dateIndex]?.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (!stamp) continue;
    const m = names.indexOf(stamp[2].toLowerCase());
    if (m < 0) continue;
    const actual = `${stamp[3]}-${String(m + 1).padStart(2, "0")}-${stamp[1].padStart(2, "0")}`;
    if (actual !== date) continue;
    const symbol = a[symbolIndex];
    const series = a[seriesIndex];
    if (!/^[A-Z0-9][A-Z0-9&_.-]{0,29}$/.test(symbol) || !["EQ", "BE", "BZ", "SM", "ST"].includes(series)) continue;
    const volume = Number(a[volumeIndex]);
    const delivery = a[deliveryIndex] === "-" ? null : Number(a[deliveryIndex]);
    if (!Number.isSafeInteger(volume) || volume < 0) continue;
    records.set(`${symbol}:${series}`, [actual, volume, delivery]);
  }
  console.log(`Parsed ${records.size} securities for ${date}`);
  return { date, records };
}

async function updateVolumeHistory() {
  const dayResults = [];
  for (const d of newDates) {
    try {
      const result = await fetchDay(d);
      if (result) dayResults.push(result);
    } catch (e) {
      console.warn(`Failed to fetch ${d}: ${e.message}`);
    }
  }

  if (dayResults.length === 0) {
    console.log("No new sessions to append.");
    return;
  }

  // Group by shard letter
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  let updatedCount = 0;

  for (const f of files) {
    const filePath = path.join(dir, f);
    const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
    let changed = false;

    for (const { date, records } of dayResults) {
      if (!content.dates.includes(date)) {
        content.dates.push(date);
        content.dates.sort();
        changed = true;
      }

      for (const [key, row] of records) {
        if (key[0].toUpperCase() === f[0].toUpperCase()) {
          const list = content.securities[key] || [];
          const existingIdx = list.findIndex((r) => r[0] === date);
          if (existingIdx >= 0) {
            list[existingIdx] = row;
          } else {
            list.push(row);
            list.sort((a, b) => a[0].localeCompare(b[0]));
          }
          content.securities[key] = list;
          changed = true;
        }
      }
    }

    if (changed) {
      content.checkedAt = new Date().toISOString();
      fs.writeFileSync(filePath, JSON.stringify(content) + "\n");
      updatedCount++;
    }
  }

  console.log(`Updated ${updatedCount} shards with new sessions (${dayResults.map((r) => r.date).join(", ")}).`);

  // Update audit log
  const auditPath = "research/nse-volume-history-audit.json";
  if (fs.existsSync(auditPath)) {
    const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
    audit.checkedAt = new Date().toISOString();
    audit.through = dayResults[dayResults.length - 1].date;
    for (const r of dayResults) {
      if (!audit.requestedDates.includes(r.date)) audit.requestedDates.push(r.date);
    }
    audit.requestedDates.sort();
    fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2) + "\n");
    console.log(`Updated ${auditPath} through ${audit.through}`);
  }
}

updateVolumeHistory().catch((e) => {
  console.error("Volume update failed:", e);
  process.exit(1);
});
