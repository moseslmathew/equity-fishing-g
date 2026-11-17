# October 2026 holdings refresh

Reporting dates: 31 October versus 30 September 2026. Imported November 2026.

- 30 of the 34 catalogued funds have October records, each with top-30 allocations and a full equity comparison.
- 17 October funds were extracted from original AMC workbooks. Scheme, reporting date, equity section, quantities and allocation units were checked; workbook extraction audits include file hashes and reconciliation evidence.
- 13 funds use explicitly labelled provider disclosures. Second-source checks may cover only part of a portfolio. Uncorroborated or conflicting quantities have review notes and do not contribute to classified additions/reductions.
- Pending: Groww Small Cap, Mirae Asset Small Cap, Franklin India Small Cap and Franklin India Mid Cap. The live Mirae/Franklin catalogues still exposed September; Groww's disclosure folders did not expose a verified October document. Historical records are retained; these schemes are excluded from October totals.
- Quantum's September workbook was recovered to support its previously missing adjacent-month comparison. No August snapshot was relabelled.

`data/october-portfolios.json` is the deployable import. `research/october-import-audit.json` records original-workbook coverage, source conflicts, corroboration counts and pending schemes. Source workbooks and raw retrieval evidence remain in the task's `work/october-disclosures` folder; the audit retains their URLs and hashes.

`research/build-october.cjs` generates the import from normalized task evidence. It excludes derivatives, debt and fund units, validates quantities and allocations, preserves positive-quantity/rounded-zero-weight positions, and withholds large unexplained movements. It does not claim all corporate actions have been reconciled.

The versioned database import uses timestamp-guarded upserts and a completion marker. It preserves newer data and all older reporting months. Monthly views, full portfolio analysis, combined funds, shared holdings and global search consume the same saved records. AI Insights derives the new month's portfolio newsletter and counts; dated company dossiers and quarterly foreign ownership are not silently re-dated.

Validation: `node research/verify-october.cjs`, `node research/verify-company-search.cjs`, `node research/verify-fund-search.cjs`, `node research/verify-newsletter.cjs`, TypeScript check, production build. The October check verifies authenticated APIs, no month fallback, prior-month preservation, exact primary SBI quantities, shared/combined coverage, refreshed newsletter, retry-safe database initialization and newer-record protection.

## Recheck on 17 November 2026

The recheck adds October provider portfolios for Groww, Mirae Asset, Franklin India Small Cap and Franklin India Mid Cap. October now covers all 43 catalogued schemes (the original 34 plus nine subsequent additions). Each new fund displays 60 holdings; full equity lists contain 73, 84, 87 and 74 current positions respectively. Original AMC validation remains pending for these four; 272 positions pass a second provider quantity/allocation check after prior discrepancies, large changes and exits are withheld. Common source feeds remain possible.

`data/october-recheck.json` contains the new records and the full recheck audit. Fresh provider current equity quantities and allocations matched existing saved records where retrieved. Three old provider URLs (DSP Small Cap, DSP Midcap and Quantum) returned 404; their existing original AMC-backed records were preserved, without changing their verification dates. No missing file or omitted record is interpreted as a sale.

Validation: `node research/verify-october-recheck.cjs` checks 43/43 monthly coverage, full comparisons, search, displayed holdings, September preservation, idempotent import and recomputed quantitative research. The dated investor outlook may be withheld if the expanded matched sample no longer matches its reviewed evidence.
