# Updating the saved agent research report

The app displays `data/agent-research.json` through the authenticated, read-only
`/api/research` endpoint. It does not run an LLM or browse when opened. The
report is independent of the month selector and is explicitly dated.

For a fresh ChatGPT research run:
1. Read ALL archived full-equity comparisons via `readAllFullComparisons`,
   including every fund and month, not only the dashboard month or top 30.
   Establish month-end dates and coverage. July-style initial snapshots are
   baselines, not inferred changes without an earlier complete comparison. Use `combinedAnalysis` to join exact names and ISINs;
   withhold totals where corporate actions or duplicate securities need review.
2. Shortlist from fund additions across complete portfolios, then evaluate a
   1–3 year business-growth thesis. Keep any existing dated price trend to one compact Dhan line: quote, daily change
   and source timestamp. Never invent quotes for new cases. Lead
   with growth mechanisms, competitive position, execution, cash needs and
   valuation. Explain what would prove or disprove each growth driver.
3. Independently of the fund reporting month, compare the newest available
   quarterly FII/FPI, DII, promoter and retail ownership to the prior
   quarter. Confirm share counts, outstanding capital and classification changes
   in original exchange filings where possible; do not call stake changes flows.
4. For each candidate, retrieve original consolidated results, cash-flow data,
   presentations, conference calls and recent exchange announcements. Search
   independent news and counterevidence, including governance, funding and
   execution risks. Separate standalone from consolidated and reported from
   adjusted figures. Guidance is not realised performance.
5. Attach per-claim HTTPS links, publisher, period and checked date. State
   inaccessible filings and unresolved conflicts. Two syndicated articles do
   not count as independent verification. Never invent missing figures, new
   orders, automated runs or numerical confidence scores.
6. Search material news and filings through the actual research date. Rewrite
   the whole report snapshot, including the cutoff date, latest disclosure dates,
   ranking basis and verification gaps. Keep introductory metadata compact and
   ownership secondary to the business analysis. Select ten research priorities with explicitly different evidence quality;
   do not conceal unresolved verification to fill the list.
7. Write exactly two main sections: one comprehensive analyst narrative and ten
   connected company growth cases. No report tables, coverage dashboards,
   separate universe/fund accordions or ownership statistics panels. Read all
   saved data internally. Explain market conditions with current dated sources,
   linking them to company growth and funding; label interpretation separately
   from observations. Use few essential numbers and attach compact citations.
   Keep portfolio evidence as prose and source links within each case.
   Refresh the whole-universe findings, each deep dive and the archived
   portfolio fingerprint. The UI must warn when analytics differ from the
   manually researched basis. Distinguish same-fund consecutive additions
   from different managers adding in different months; do not sum monthly
   deltas or interpret missing fund data as zero. Preserve reviewed/ambiguous
   quantities as withheld. Update exact-company matching and types if the universe changes. Run type
   checking and confirm each company's fund contributions against the full
   portfolio. Build and publish the changed Site source using Sites workflow.

No live-agent API credentials, scheduler or automatic news refresh are configured
by this report feature. Future autonomous execution requires a separately
implemented server-side research workflow and verified source access.

Record the actual creating agent name and research refresh time in the report.
Recheck news and Dhan data on each requested research run. Do not change the
quote timestamp to the research date when the latest trading quote is older.

Presentation: this is a one-to-three-year investment report, not a daily recap.
Do not lead with a named trading day, daily index moves or daily stock prices.
Keep the actual review cutoff and source dates for provenance. Company cases
and fund Analysis actions open in dialogs, never expand into the page.

Model attribution: record the exact generating model identifier in `modelName` only when supplied by trusted runtime metadata. Codex and ChatGPT are product/agent names, not model versions. If the identifier is unavailable, use `Not recorded`; never infer a model from the product name or a selectable model list. Preserve `createdBy` separately for agent provenance.
