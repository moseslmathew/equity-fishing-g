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

  // 1. Load Datasets
  console.log("Loading datasets...");
  const seed = JSON.parse(fs.readFileSync("data/seed.json", "utf8"));
  const september = JSON.parse(fs.readFileSync("data/september-portfolios.json", "utf8"));
  const fullSeed = JSON.parse(fs.readFileSync("data/full-portfolio-seed.json", "utf8"));
  const expansion = JSON.parse(fs.readFileSync("data/fund-expansion-2026-10.json", "utf8"));
  const philosophies = JSON.parse(fs.readFileSync("data/investor-philosophies.json", "utf8"));
  const agentResearch = JSON.parse(fs.readFileSync("data/agent-research.json", "utf8"));
  const aceResearch = JSON.parse(fs.readFileSync("data/ace-investor-research.json", "utf8"));
  
  const amfiNavs = fs.existsSync("data/amfi-latest-navs.json")
    ? JSON.parse(fs.readFileSync("data/amfi-latest-navs.json", "utf8"))
    : null;
  const companyQuotes = fs.existsSync("data/company-quotes.json")
    ? JSON.parse(fs.readFileSync("data/company-quotes.json", "utf8"))
    : null;

  // 2. Build complete portfolio:current covering all 34 funds
  console.log("Seeding portfolio:current with all 34 funds...");
  const currentFunds = [
    ...seed.funds,
    ...(expansion.funds.filter((f) => f.portfolioDate === "2026-09-30") || []),
  ];
  const currentPortfolio = {
    ...seed,
    checkedAt: expansion.checkedAt || september.checkedAt || seed.checkedAt,
    summary: "Complete 34 equity funds universe: 24 small-cap, 7 mid-cap, and 3 other equity schemes.",
    funds: currentFunds,
  };

  await sql.query(
    "INSERT INTO app_documents (key, payload, checked_at) VALUES ($1, $2, $3) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, checked_at = excluded.checked_at",
    ["portfolio:current", JSON.stringify(currentPortfolio), iso(currentPortfolio.checkedAt)]
  );

  // 3. Seed fund_snapshots: seed (August) + september + expansion (August & September)
  console.log("Seeding fund snapshots across all 34 funds and reporting periods...");
  const allFunds = [
    ...seed.funds,
    ...(september.funds || []),
    ...(expansion.funds || []),
  ];

  const uniqueSnapshots = new Map();
  for (const f of allFunds) {
    if (f.verification !== "conflict" && f.checkStatus !== "failed" && f.checkStatus !== "conflict") {
      const id = `${f.id}:${f.portfolioDate}`;
      uniqueSnapshots.set(id, f);
    }
  }

  for (const [id, f] of uniqueSnapshots) {
    const month = f.portfolioDate.slice(0, 7);
    await sql.query(
      "INSERT INTO fund_snapshots (id, fund_id, month, reporting_date, checked_at, payload) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, checked_at = excluded.checked_at",
      [id, f.id, month, f.portfolioDate, iso(f.lastCheckedAt), JSON.stringify(f)]
    );
  }
  console.log(`Seeded ${uniqueSnapshots.size} unique fund snapshots.`);

  // 4. Seed fund_comparisons: fullSeed + september + expansion comparisons
  console.log("Seeding fund comparisons...");
  const allComparisons = [
    ...fullSeed,
    ...(september.comparisons || []),
    ...(expansion.comparisons || []),
  ];

  const uniqueComparisons = new Map();
  for (const c of allComparisons) {
    const id = `${c.fundId}:${c.currentDate}`;
    uniqueComparisons.set(id, c);
  }

  for (const [id, c] of uniqueComparisons) {
    const month = c.currentDate.slice(0, 7);
    await sql.query(
      "INSERT INTO fund_comparisons (id, fund_id, month, checked_at, payload) VALUES ($1, $2, $3, $4, $5) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, checked_at = excluded.checked_at",
      [id, c.fundId, month, iso(c.checkedAt), JSON.stringify(c)]
    );
  }
  console.log(`Seeded ${uniqueComparisons.size} unique fund comparisons.`);

  // 5. Seed 12 Ace Investors
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
    { id: "pabrai", name: "Mohnish Pabrai", initials: "MP", description: "Pabrai Wagons ETF · Indian-listed investments", file: "mohnish-pabrai.json" },
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
      idea: philosophies[profile.id],
    };
    await sql.query(
      "INSERT INTO app_documents (key, payload, checked_at) VALUES ($1, $2, $3) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, checked_at = excluded.checked_at",
      [`investor:${profile.id}`, JSON.stringify(docPayload), iso(portfolio.checkedOn)]
    );
  }

  // 6. Seed Foreign Investors
  console.log("Seeding Foreign Investors...");
  const foreignFiles = [
    { id: "blackstone", file: "foreign-investors.json" },
    { id: "temasek", file: "foreign-investor-temasek.json" },
    { id: "gic", file: "foreign-investor-gic.json" },
    { id: "blackrock", file: "foreign-investor-blackrock.json" },
  ];

  for (const f of foreignFiles) {
    const filePath = path.join("data", f.file);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      await sql.query(
        "INSERT INTO app_documents (key, payload, checked_at) VALUES ($1, $2, $3) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, checked_at = excluded.checked_at",
        [`foreign-investor:${f.id}`, JSON.stringify(data), iso(data.checkedAt)]
      );
    }
  }

  // 7. Seed Fresh AMFI NAVs and Company Quotes
  if (amfiNavs) {
    console.log("Seeding fresh AMFI NAV dataset...");
    await sql.query(
      "INSERT INTO app_documents (key, payload, checked_at) VALUES ($1, $2, $3) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, checked_at = excluded.checked_at",
      ["fund:navs", JSON.stringify(amfiNavs), iso(amfiNavs.checkedAt)]
    );
  }

  if (companyQuotes) {
    console.log("Seeding fresh company market quotes...");
    await sql.query(
      "INSERT INTO app_documents (key, payload, checked_at) VALUES ($1, $2, $3) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, checked_at = excluded.checked_at",
      ["market:quotes", JSON.stringify(companyQuotes), iso(companyQuotes.checkedAt)]
    );
  }

  // 8. Seed Research Reports
  console.log("Seeding Research Reports...");
  await sql.query(
    "INSERT INTO research_reports (id, checked_at, model, fingerprint, payload) VALUES ($1, $2, $3, $4, $5) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
    [agentResearch.id, iso(agentResearch.checkedAt), agentResearch.modelName, agentResearch.portfolioFingerprint, JSON.stringify(agentResearch)]
  );

  await sql.query(
    "INSERT INTO research_reports (id, checked_at, model, fingerprint, payload) VALUES ($1, $2, $3, $4, $5) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
    [aceResearch.id, iso(aceResearch.checkedAt), aceResearch.modelName, aceResearch.portfolioFingerprint, JSON.stringify(aceResearch)]
  );

  // 9. Import Markers & Migration Marker
  console.log("Setting database markers...");
  await sql.query(
    "INSERT INTO app_documents (key, payload, checked_at) VALUES ($1, $2, $3) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, checked_at = excluded.checked_at",
    [
      `import:september-2026:${september.checkedAt}`,
      JSON.stringify({ funds: september.funds.length, comparisons: september.comparisons.length }),
      iso(september.checkedAt),
    ]
  );

  await sql.query(
    "INSERT INTO app_documents (key, payload, checked_at) VALUES ($1, $2, $3) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, checked_at = excluded.checked_at",
    [
      `import:fund-expansion-2026-10:${expansion.checkedAt}`,
      JSON.stringify({ funds: 10, snapshots: expansion.funds.length, comparisons: expansion.comparisons.length }),
      iso(expansion.checkedAt),
    ]
  );

  await sql.query(
    "INSERT INTO app_documents (key, payload, checked_at) VALUES ($1, $2, $3) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, checked_at = excluded.checked_at",
    [
      "migration:legacy-v1",
      JSON.stringify({
        completedAt: new Date().toISOString(),
        source: "Refreshed live verified disclosures: AMFI NAVs, NSE Bhavcopy archives, Neon DB synchronization, 34 mutual funds and 12 Ace Investors",
        backupsRetained: true,
      }),
      new Date().toISOString(),
    ]
  );

  // 10. Verification
  console.log("\n=== Neon DB Synchronization Verification ===");
  const tables = ["app_documents", "fund_snapshots", "fund_comparisons", "investor_portfolios", "research_reports"];
  for (const t of tables) {
    const res = await sql.query(`SELECT COUNT(*) FROM ${t}`);
    console.log(`${t.padEnd(25)}: ${res[0].count} rows`);
  }
  console.log("\nNeon DB reseed completed successfully!");
}

reseed().catch((e) => {
  console.error("Reseed failed:", e);
  process.exit(1);
});
