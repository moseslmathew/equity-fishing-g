# Observatory data audit — 22 October 2026

## Corrections

- Fund search, shared holdings and combined selected portfolios now reconcile exact disclosed name variants using ISINs. Previously, combined analysis joined these identities while the other views split them. This affected companies including Federal Bank, CDSL, Indian Hotels and Kirloskar Pneumatic. No fuzzy matching is introduced.
- Company search retains every disclosed name and adds exact NSE symbols as searchable aliases. Prior allocations use the same identity mapping.
- Combined analysis distinguishes current holders from exited funds: Indo-MIM has eight current holders and two exited funds, rather than an ambiguous “10 funds” badge.
- The sum of separate funds’ allocation percentages is labelled “Allocation sum”; it is not a combined portfolio weight or company ownership percentage.
- Combined selected-fund search filters company rows without accidentally filtering the fund sidebar to zero or switching to all-fund results.
- Missing previous allocation/change values remain at the bottom in both sort directions.
- The September-import regression now includes the expanded 34-fund catalog and its separate migration marker.

## Checks completed

- Live D1 inventory: 68 fund snapshots (34 August, 34 September), 53 full comparisons (20 August, 33 September), 12 investor portfolios and four saved research records. All fund/comparison identifiers and checked timestamps match the bundled database records. The database connector truncates large payloads, so this is metadata verification rather than a byte-for-byte comparison of every live payload.
- Integration checks enumerate 2,135 current fund/company positions for August and 2,810 for September. All active comparison positions resolve to the matching company-search record after the fix.
- No duplicate fund/company identities, allocation conflicts beyond display rounding, invalid allocation totals or zero-share/positive-allocation contradictions were found in the checked records.
- 1,083 linked preceding-month share quantities reconcile across saved comparisons.
- Re-downloaded all 23 original spreadsheet/ZIP disclosure URLs referenced by September comparisons. All 18 files with retained earlier checksums match; five files have no earlier checksum to compare. No source file is silently relabelled as newly researched holdings. Download details are in source-recheck-2026-10-22.json.
- Existing checks cover investor legal-holder separation, ownership versus portfolio weights, missing versus zero ownership, venture investment scope, market-data timestamps, authentication, database history, corporate-action review withholding and saved-report provenance.

## Limits

This is a consistency and retained-evidence audit, not fresh filing-by-filing certification of every fact in every investor/company research report. Provider-derived positions, unresolved corporate-action rows and historical venture-capital stakes retain their existing limitations. Quantum still lacks a September full-share comparison; its top-30 allocations must not be treated as full quantity coverage. September contains seven fund/company review rows, whose disputed changes remain withheld. The October monthly snapshot has not been imported.

Raw verified holdings were not changed: the confirmed defects were company identity reconciliation and presentation. The correction applies when reading the database and does not require rewriting historical holdings.
