# Equity Fishing — project source copy

Synchronized with Smallcap Observatory source commit `d500b7987249314ddd5901ecd0c8e7d1057073ea` (published version 72), on 20 October 2026.

Latest changes include Foreign Investors coverage (Blackstone, Temasek, GIC and BlackRock), the fund sidebar, company search across funds, full-portfolio shared holdings, and month-to-month company allocation comparisons.

This copy contains the React/TypeScript application, backend APIs, database code, bundled portfolio snapshots, AI research reports, source links and verification scripts. Generated builds, dependencies, credentials and local runtime state are excluded.

The original live Site has not been changed. Its project identifier is deliberately removed from `.openai/hosting.json` so this copy is not accidentally deployed over the existing Site.

## Runtime requirements

- Node.js 22.13 or newer; package manager and exact dependency versions are recorded in `package.json` and `pnpm-lock.yaml`.
- Vinext/Vite application targeting Cloudflare Workers, with D1 binding `DB` and R2 binding `BUCKET`.
- Configure `LOGIN_PASSWORD`, `SESSION_SECRET` and `UPDATE_KEY` as runtime secrets. No real secret values are included.
- The source contains seed data, not an export of the live D1 database or R2 bucket. A separate deployment needs its own storage and secrets.
- AI reports are saved research documents. Opening a report does not invoke a live AI service. No active refresh schedule is included.
- Installation/build entry points: `pnpm install`, `pnpm dev`, `pnpm build`. Hosting requires the appropriate Workers/Sites configuration; this is not a static-only React application.

## Original project documentation

# Smallcap Observatory

Password-protected dashboard for twenty small-cap mutual funds. The initial verified
snapshot is dated 31 August 2026. It contains 15 company holdings per fund,
allocation weights, source links and confirmation levels. Fund details and top-15 overlap are available from the dashboard.

## Data and scheduled updates

Persistent snapshot: R2 binding BUCKET, key portfolio/current.json. The immutable
initial seed is used only before the first persisted snapshot. Storage failures
return an unavailable state instead of silently falling back to a stale seed.

GET /api/portfolio reads the shared saved data.
POST /api/portfolio accepts {snapshot: Portfolio, kind: "check"}.
The server validates the entire twenty-fund snapshot, rejects older reporting
dates, preserves verified holdings on failed or conflicting checks, and computes
top-15 changes itself. It records entries into and departures from the top 15,
not purchases or full portfolio exits.

The full update procedure and schema are in data/update-plan.json and served at
GET /api/update-plan so a new cloud run can retrieve instructions without a local
checkout. Read current source URLs from each fund's sources array. Public web
sources do not require connected-app accounts. New monthly disclosures must be
corroborated against two source domains; official + another source is preferred.

### Unattended access

Get this linked Site through the Sites connector. Confirm active, published and
owner role before writing. All updater reads, writes and the update-plan endpoint
require X-Fund-Update-Key matching the hosted UPDATE_KEY secret. Obtain this only
through approved runtime secret injection. A Sites dispatch credential alone does
not authorize the app writer. If a cloud task cannot obtain supported writer
access, report the prerequisite and do not claim that scheduling is ready.
Never log or persist credentials or place them in schedule prompts.

The public entry point shows a password form. LOGIN_PASSWORD and SESSION_SECRET
are hosted secrets; the password is not present in source or browser bundles.
Signed HttpOnly, Secure, SameSite=Strict sessions last seven days. Browser sessions
can read holdings but cannot mutate portfolio data or retrieve update instructions.
Keep the independent updater authorization when changing Site sharing settings.

### Run procedure

Read GET /api/update-plan and GET /api/portfolio. Check official monthly portfolios
and corroborating providers for each of the twenty funds. Verify date, company
names and percentages of total net assets. Exclude cash and TREPS. On no new
disclosure keep holdings and update the check timestamp; on conflict or failed
retrieval retain the last verified holdings and record the limitation. Update
the summary honestly. POST the complete snapshot with kind="check", then GET it
back to confirm persistence. No rebuild or republication is needed for data-only
updates. A transient write can be retried once with the same payload, after
checking readback. On persistent failure report the failure without claiming
the dashboard was updated.

Scheduling: daily 08:00 Asia/Kolkata. The schedule.enabled field is changed only
after successful native schedule creation or an explicit pause/resume. Settings
changes use kind="settings" and do not create an extra check-history event.

## Build

The bundled Sites/Vinext starter produces a Cloudflare Worker-compatible build.
Use the Sites build and publish workflow. Logical hosting bindings live in
.openai/hosting.json; credentials and preview state never belong in source.

Reporting months: the dashboard selects current month, last month, or an available archived month. GET /api/portfolio?month=YYYY-MM returns only holdings belonging to that reporting month, missing fund IDs and the preceding month for allocation comparisons. GET without a month keeps the existing complete updater snapshot. Verified per-fund monthly records are archived in R2 before the latest snapshot advances. Month-end figures that are not verified and saved remain pending.

## Full portfolio comparisons

The Analysis panel compares all company share quantities between adjacent reporting months. It includes increased/decreased continuing positions, new/exited companies, unchanged rows and explicit review rows. Cash and debt are excluded. August 2026 provider comparisons versus July are in `data/full-portfolio-seed.json`; these are independently labeled from the top-15 verification status. Sources and checked scope are visible in each panel. Earlier share quantities are derived only from reported quantity changes, never weight changes.

Authenticated readers can GET `/api/full-portfolio?month=YYYY-MM`. The independent update key is required to POST `{comparison: FullComparison}` to `/api/full-portfolio`. Records are saved per fund/month at `portfolio/full/YYYY-MM/<fundId>.json`; no browser session can write. Reporting month reads include `fullComparisons` only for that exact month, with no old-month fallback. The future update plan describes full disclosure extraction and corporate-action reconciliation. No daily update task is currently enabled.

## Fund coverage and layout

The catalog contains twenty active small-cap schemes, retaining the original eight and adding twelve eligible schemes by reported scheme AUM. Bank-branded AMCs, Tata, Franklin and Quant are excluded, as are index funds, ETFs and FoFs. This is a coverage shortlist, not a claim that twenty AMCs have proven superior research quality. `lib/fund-catalog.ts` stores the names, ordering and dated selection evidence; holdings reporting dates remain independent.

The dashboard uses two fund cards per row on desktop and one on mobile. Each card shows 15 company allocations, with full portfolio analysis and sources expanded on demand. The month-change loading indicator is preserved. Existing eight-fund R2 snapshots are expanded at read time with new catalog seeds; saved holdings and monthly archives remain intact. The writer requires all twenty IDs, and rejects an old eight-fund update. All twenty August full-equity comparisons versus July are seeded; debt, derivatives and cash are excluded and ambiguous security entries/exits are consolidated into explicit review rows.

## Top 15 holdings

The August seed has fifteen company holdings per fund, ranked by disclosed percentage of net assets from the existing complete equity datasets. Existing top-five figures are preserved. `holdingsEvidence` records additional source scope separately, so original top-five verification is not presented as verification of every added allocation. The reader expands legacy five-position records only using a complete, same-date comparison with matching original figures. Historical months with only five saved ranks remain explicitly partial; unmatched positions are not labeled new to the top 15. The writer requires fifteen positions per fund. No share quantities or dates are changed by this expansion.

The interface uses a fixed Violet palette. The theme selector and update-history section are removed; Cards/Table preferences remain device-local. Server update logging continues for data maintenance.

## Combined portfolio analysis

The common analysis section uses complete adjacent-month equity comparisons for the selected reporting month, including positions outside the top 15. Companies are grouped by exact normalized names and matched ISINs, with one contribution per fund. Company net share changes sum quantities across available funds; individual allocation percentages are never summed. Any disputed contribution withholds the company's net classification. Mixed-direction filters identify funds adding and reducing the same company, even when the combined net is positive or negative. Missing fund comparisons are explicitly excluded. Company rows expand to full fund names, quantities, movements, allocation and dated source links. Per-fund analysis remains available.

### Ace investors
The header navigation opens a separate Ace investors workspace. Vijay Kedia's portfolio is a searchable modal with direct/entity attribution, company ownership percentages, share quantities, individual reporting dates and source links. `data/ace-investors.json` is a manually checked public-disclosure snapshot, not a complete investor book or a live trading feed. Refresh records only after reconciling the reporting period and pre/post-IPO basis; missing values must not be interpreted as exits.
Ashish Kacholia uses `data/ashish-kacholia.json`: named direct holdings are shown separately from associated-company stakes, and older March records are explicitly marked as unconfirmed current ownership. Reconciliation exclusions are visible inside his portfolio modal. Opening another investor resets search and holder filters.
