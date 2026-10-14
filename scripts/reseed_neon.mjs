import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function reseed() {
  console.log("=== Wiping Neon Database ===");
  await sql.query("TRUNCATE TABLE app_documents, fund_snapshots, fund_comparisons, investor_portfolios, research_reports CASCADE;");
  console.log("Tables truncated successfully.");

  const iso = (s) => new Date(s).toISOString();

  // 1. Seed portfolio:current and 20 mutual funds
  console.log("Seeding mutual funds and portfolio:current...");
  const seed = JSON.parse(fs.readFileSync("data/seed.json", "utf8"));
  const september = JSON.parse(fs.readFileSync("data/september-portfolios.json", "utf8"));
  const fullSeed = JSON.parse(fs.readFileSync("data/full-portfolio-seed.json", "utf8"));
  const philosophies = JSON.parse(fs.readFileSync("data/investor-philosophies.json", "utf8"));
  const agentResearch = JSON.parse(fs.readFileSync("data/agent-research.json", "utf8"));
  const aceResearch = JSON.parse(fs.readFileSync("data/ace-investor-research.json", "utf8"));

  // app_documents: portfolio:current
  await sql.query(
    "INSERT INTO app_documents (key, payload, checked_at) VALUES ($1, $2, $3) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, checked_at = excluded.checked_at",
    ["portfolio:current", JSON.stringify(seed), iso(seed.checkedAt)]
  );

  // fund_snapshots: seed + september
  const allFunds = [...seed.funds, ...(september.funds || [])];
  for (const f of allFunds) {
    if (f.verification !== "conflict" && f.checkStatus !== "failed" && f.checkStatus !== "conflict") {
      const id = `${f.id}:${f.portfolioDate}`;
      const month = f.portfolioDate.slice(0, 7);
      await sql.query(
        "INSERT INTO fund_snapshots (id, fund_id, month, reporting_date, checked_at, payload) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, checked_at = excluded.checked_at",
        [id, f.id, month, f.portfolioDate, iso(f.lastCheckedAt), JSON.stringify(f)]
      );
    }
  }

  // fund_comparisons: fullSeed + september comparisons
  const allComparisons = [...fullSeed, ...(september.comparisons || [])];
  for (const c of allComparisons) {
    const id = `${c.fundId}:${c.currentDate}`;
    const month = c.currentDate.slice(0, 7);
    await sql.query(
      "INSERT INTO fund_comparisons (id, fund_id, month, checked_at, payload) VALUES ($1, $2, $3, $4, $5) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, checked_at = excluded.checked_at",
      [id, c.fundId, month, iso(c.checkedAt), JSON.stringify(c)]
    );
  }

  // 2. Seed 12 Ace Investors
  console.log("Seeding 12 Ace Investors...");
  const aceProfiles = [
    { id: "kedia", name: "Vijay Kedia", initials: "VK", description: "Direct holdings & Kedia Securities", file: "ace-investors.json" },
    { id: "kacholia", name: "Ashish Kacholia", initials: "AK", description: "Personal holdings · Other holders shown separately", file: "ashish-kacholia.json" },
    { id: "mukul", name: "Mukul Agrawal", initials: "MA", description: "Personal disclosed holdings", file: "mukul-agrawal.json" },
    { id: "malabar", name: "Malabar Investments", initials: "MI", description: "Sumeet Nagar · Disclosed fund holdings", file: "malabar-investments.json" },
    { id: "nalanda", name: "Nalanda Capital", initials: "NC", description: "Pulak Prasad · Disclosed fund holdings", file: "nalanda-capital.json" },
    { id: "abakkus", name: "Abakkus", initials: "AB", description: "Sunil Singhania · Disclosed investment vehicles", file: "abakkus.json" },
    { id: "goel", name: "Anil Kumar Goel", initials: "AG", description: "Personal disclosed holdings", file: "anil-kumar-goel.json" },
    { id: "dolly", name: "Dolly Khanna", initials: "DK", description: "Rajiv Khanna manages · Dolly’s disclosed holdings", file: "dolly-khanna.json" },
    { id: "porinju", name: "Porinju Veliyath", initials: "PV", description: "Personal holdings · PMS positions excluded", file: "porinju-veliyath.json" },
    { id: "dhawan", name: "Ashish Dhawan", initials: "AD", description: "Personal holdings · ChrysCapital positions excluded", file: "ashish-dhawan.json" },
    { id: "nemish", name: "Nemish S. Shah", initials: "NS", description: "Individual disclosures · Family and HUF separated", file: "nemish-shah.json" },
    { id: "pabrai", name: "Mohnish Pabrai", initials: "MP", description: "Pabrai Wagons ETF · Indian-listed investments", file: "mohnish-pabrai.json" }
  ];

  for (const profile of aceProfiles) {
    const portfolio = JSON.parse(fs.readFileSync(path.join("data", profile.file), "utf8"));
    const id = `${profile.id}:${portfolio.checkedOn}`;
    await sql.query(
      "INSERT INTO investor_portfolios (id, investor_id, checked_at, payload) VALUES ($1, $2, $3, $4) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
      [id, profile.id, iso(portfolio.checkedOn), JSON.stringify(portfolio)]
    );

    const docPayload = {
      id: profile.id,
      name: profile.name,
      initials: profile.initials,
      description: profile.description,
      holdingsCount: portfolio.holdings.length,
      idea: philosophies[profile.id]
    };
    await sql.query(
      "INSERT INTO app_documents (key, payload, checked_at) VALUES ($1, $2, $3) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, checked_at = excluded.checked_at",
      [`investor:${profile.id}`, JSON.stringify(docPayload), iso(portfolio.checkedOn)]
    );
  }

  // 3. Seed Research Reports
  console.log("Seeding Research Reports...");
  await sql.query(
    "INSERT INTO research_reports (id, checked_at, model, fingerprint, payload) VALUES ($1, $2, $3, $4, $5) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
    [agentResearch.id, iso(agentResearch.checkedAt), agentResearch.modelName, agentResearch.portfolioFingerprint, JSON.stringify(agentResearch)]
  );

  await sql.query(
    "INSERT INTO research_reports (id, checked_at, model, fingerprint, payload) VALUES ($1, $2, $3, $4, $5) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
    [aceResearch.id, iso(aceResearch.checkedAt), aceResearch.modelName, aceResearch.portfolioFingerprint, JSON.stringify(aceResearch)]
  );

  // 4. Migration marker
  await sql.query(
    "INSERT INTO app_documents (key, payload, checked_at) VALUES ($1, $2, $3) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, checked_at = excluded.checked_at",
    [
      "migration:legacy-v1",
      JSON.stringify({
        completedAt: new Date().toISOString(),
        source: "Latest verified disclosures across multiple primary and provider sources (Trendlyne, Finology, BSE/NSE XBRL, AMFI/AMC factsheets)",
        backupsRetained: true
      }),
      new Date().toISOString()
    ]
  );

  // 5. Verify counts
  console.log("\n=== Reseed Verification ===");
  const tables = ["app_documents", "fund_snapshots", "fund_comparisons", "investor_portfolios", "research_reports"];
  for (const t of tables) {
    const res = await sql.query(`SELECT COUNT(*) FROM ${t}`);
    console.log(`${t.padEnd(25)}: ${res[0].count} rows`);
  }
  console.log("\nReseed completed successfully with latest verified data!");
}

reseed().catch((e) => {
  console.error("Reseed failed:", e);
  process.exit(1);
});
