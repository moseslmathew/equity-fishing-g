import type snapshot from "../data/agent-research.json";
import type { combinedAnalysis } from "./combined-analysis";
import type { FullComparison } from "./full-portfolio";
import { computeForensicInsights, type ForensicStoryEnhancement } from "./forensic-analysis";
import { fundCatalog } from "./fund-catalog";

type MonthAnalysis = ReturnType<typeof combinedAnalysis> & { month: string };

export interface NewsletterStory {
  label: string;
  title: string;
  paragraphs: string[];
  refs: number[];
  forensic?: ForensicStoryEnhancement;
}

export function monthlyLetter(
  report: typeof snapshot,
  period: MonthAnalysis,
  comparisons: FullComparison[],
  analyses?: MonthAnalysis[],
  allComparisons?: FullComparison[]
) {
  const month = period.month;
  if (month <= report.fundMonth) return null;

  const label = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(month + "-01T00:00:00Z"));

  const checkedAt = comparisons.map((c) => c.checkedAt).sort().at(-1)!;
  const primary = comparisons.filter((c) => c.basis === "official_disclosures").length;
  const pendingNames = period.missingFunds
    .map((id) => fundCatalog.find((f) => f.id === id)?.name ?? id)
    .join(", ");
  const forensic = computeForensicInsights(analyses ?? [period], allComparisons ?? comparisons);
  const zetwerk = forensic.preIpo.rows[0];
  const zeroExitNames = forensic.zeroExits.rows
    .slice(0, 4)
    .map((r) => r.entity.replace(/\s+(Limited|Ltd\.?)$/i, ""))
    .join(", ");

  const stories: NewsletterStory[] = [
    {
      label: "HIDDEN SIGNAL 01 · PRE-IPO RUSH",
      title: "The October unlisted & pre-IPO sweep: zero to multi-fund in thirty days",
      paragraphs: [
        `The clearest hidden anomaly across the three-month archive is a synchronized October deployment into unlisted and newly allotted pre-IPO equity. ${
          zetwerk
            ? `${zetwerk.entity} moved from zero presence in August and September to ${zetwerk.trajectory} (${zetwerk.hiddenMetric}) in a single reporting month, with ${zetwerk.crossSignal}.`
            : "Multiple unlisted industrial manufacturers moved from zero coverage in September to multi-fund ownership in October."
        } Bonfiglioli Transmissions, SFC Environmental Technologies, Sahajanand Medical Technologies, Jio Platforms, and Tonbo Imaging followed the same zero-to-multi-scheme pattern.`,
        "This matters because unlisted placements do not register on daily exchange price or volume feeds. When multiple independent fund houses initiate private tranches simultaneously—alongside Accel-backed Rentomojo climbing from 0 funds in August to 7 in October with 10 cumulative additions and zero cuts—managers are locking up illiquid equity ahead of anticipated public listings. Check valuation marks across scheme disclosures before extrapolating secondary-market pricing.",
      ],
      refs: [16],
      forensic: forensic.preIpo,
    },
    {
      label: "HIDDEN SIGNAL 02 · FII HANDOFF",
      title: "Cross-institutional supply transfer: domestic funds absorbing foreign selling",
      paragraphs: [
        "Cross-referencing Q2 FY27 foreign institutional ownership shifts (June to September 2026) against three-month mutual fund share ledgers (August to October) uncovers a massive structural liquidity handoff. Rather than chasing foreign inflows, domestic small- and mid-cap managers stepped in as liquidity absorbers when FIIs cut positions by 4.5 to 10.2 percentage points in a single quarter—including PB Fintech (-10.17 pp QoQ, -48.9% off its 52-week high), Dr Agarwals Health Care (-8.41 pp QoQ, 9 MF additions with zero cuts), TBO Tek (-6.41 pp QoQ), 360 ONE WAM (-4.58 pp QoQ), and One 97 Communications / Paytm (-4.57 pp QoQ, 12 three-month MF additions and up to 8.44% single-fund weight).",
        "Where both foreign and domestic institutions bought simultaneously—notably Pine Labs (FII +3.69 pp QoQ alongside 9 MF additions and 1 cut while trading 44.7% below its 52-week high) and Granules India (FII +2.75 pp QoQ with 5 MF additions and zero cuts)—the signal carries dual-engine alignment. Distinguishing domestic absorption of foreign block supply from dual-sided buying prevents mistaking a falling FII percentage for broad institutional abandonment.",
      ],
      refs: [15, 16],
      forensic: forensic.handoff,
    },
    {
      label: "HIDDEN SIGNAL 03 · MICROSTRUCTURE",
      title: "NSE delivery breakouts and deep-drawdown contrarian accumulation",
      paragraphs: [
        "Overlaying three months of daily NSE Bhavcopy delivery percentages and 52-week price drawdowns onto mutual fund share changes reveals stealth accumulation occurring below headline market highs. Redington’s weighted delivery percentage more than doubled from 23.5% in August to 50.0% in October even as trading volume cooled—corroborated by 7 MF additions against 1 cut alongside roughly 35% aggregate ownership across seven named global funds. Navin Fluorine (29.6% to 55.1% across 17 holder funds) and Ratnamani Metals (29.8% to 48.0%) displayed similar institutional lock-up signatures.",
        "Equally striking is price discipline: managers concentrated multi-month share buying in names trading 28% to 51% below their 52-week highs, including Swiggy (-50.7% off high, 10 holder funds), Five Star Business Finance (-29.5%, October delivery jumping to 56.3%), and Ratnamani Metals (-29.0%), alongside steady cryogenic accumulation in INOX India (23.1% to 39.2% delivery, 11 additions against 1 cut). Rising delivery during quiet volume consolidation provides stronger confirmation than high-turnover price breakouts.",
      ],
      refs: [14, 7],
      forensic: forensic.microstructure,
    },
    {
      label: "HIDDEN SIGNAL 04 · DIVERGENCE & CHURN",
      title: "Capital rotation inside exchanges, Ace clashes, and speculative churn alerts",
      paragraphs: [
        "Three-month forensic screening exposes sharp contradictions hidden beneath aggregate holder counts. Inside financial market infrastructure, funds rotated decisively out of BSE (2 additions vs 6 reductions and 3 full exits, dropping from 24.9 lakh to 14.5 lakh shares as Kotak and Edelweiss Mid Cap exited) while piling into MCX (21 three-month additions, 20 October holders) and CDSL (8 additions, zero cuts). Meanwhile, Neuland Laboratories illustrates an Ace-versus-MF divergence: Malabar Investments (5.42%), Mukul Agrawal (3.12%), and Vijay Kedia (1.01%) combined own 9.55%, yet mutual funds executed 11 reductions/exits versus 7 additions.",
        "Exchange microstructure also flags warning signs. Karur Vysya Bank saw October volume more than double from 35.1M to 73.3M shares while delivery collapsed from 52.3% to 33.5%, signaling speculative churn beneath a 17-fund consensus. Similarly, stealth distribution waves emerged in Radico Khaitan (4 adds vs 11 cuts), Welspun Corp (7 adds vs 12 cuts even while FIIs added +8.48 pp), Eternal (4 adds vs 9 cuts, TRUSTMF October exit), and Indo-MIM (6 adds vs 7 cuts, 4 exits including Abakkus in October).",
      ],
      refs: [14, 15],
      forensic: forensic.divergence,
    },
    {
      label: "HIDDEN SIGNAL 05 · ZERO-EXIT CORE & AUDIT",
      title: "Zero-exit compounders across 3 months and provenance audit of 561 review rows",
      paragraphs: [
        `Filtering the entire 34-fund, ${forensic.totalUniqueCompanies3M}-company three-month matrix for securities with zero reductions across August, September, and October isolates the highest-persistence holdings: ${zeroExitNames}, alongside Voltamp Transformers and Data Patterns. Schaeffler India expanded from 4 to 11–12 holders with 9 additions, zero cuts, and 60.8%–64.5% sticky NSE delivery; INOX India saw Abakkus (+50%/+9%/+44%) and Canara Robeco (+416%/+15%) compound shares across consecutive periods as delivery climbed from 23.1% to 39.2%.`,
        `Data hygiene remains non-negotiable. Out of ${forensic.totalLatestRows.toLocaleString("en-IN")} October comparison rows across ${primary} original AMC workbooks and ${comparisons.length - primary} provider disclosures, ${period.reviewPositions} rows remain quarantined in review—comprising ${forensic.uncorroboratedRows} single-source provider rows awaiting second-domain confirmation, ${forensic.corporateActionRows} positions triggering the ≥1.9x/≤0.51x corporate-action safeguard, and ${forensic.mismatchRows} prior-quantity discrepancies. Withholding unverified trades prevents splits or missing files from distorting real capital allocation.`,
      ],
      refs: [0, 1, 7, 8, 13],
      forensic: forensic.zeroExits,
    },
  ];

  return {
    id: report.id + ":portfolio:" + month,
    title: label + ": three-month forensic intelligence & hidden signals",
    fundMonth: month,
    asOf: checkedAt.slice(0, 10),
    checkedAt,
    method:
      "Cross-dataset forensic engine recomputing three-month mutual fund share deltas (Aug–Oct 2026) against quarterly FII shareholding (Jun–Sep 2026), daily NSE Bhavcopy delivery ratios, 52-week market quotes, and Ace/VC registries. Uncorroborated provider rows and ≥1.9x/≤0.51x corporate-action ratios are quarantined out of directional counts.",
    refreshedLabel:
      "Forensic synthesis refreshed " +
      new Date(checkedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }),
    summary: `A cross-dataset forensic dive across 34 mutual fund schemes (${forensic.totalUniqueCompanies3M} unique companies over August–October 2026), statutory FII filings, and NSE delivery microstructure—exposing unlisted pre-IPO sweeps, FII-to-DII liquidity handoffs, stealth delivery breakouts, and hidden distribution waves.`,
    coverageNote: `${primary} October workbooks were extracted directly from original AMC disclosures; ${
      comparisons.length - primary
    } comparisons use labelled provider disclosures. ${
      period.missingFunds.length
    } schemes remain pending verified October files (${pendingNames}), with September holdings retained intact.`,
    newsletter: {
      edition: label.toUpperCase() + " · 3M FORENSIC BRIEF",
      editorNote: `Dear reader,\n\nHeadline mutual fund summaries—listing which large companies appear in the most schemes—rarely reveal where institutional edge actually lies. By stitching together three consecutive months of mutual fund share ledgers (August: 20 funds, September: 33 funds, October: ${period.coverage} funds) with quarterly foreign institutional ownership, daily NSE delivery ratios, 52-week price drawdowns, and Ace/VC disclosures, we isolated five non-obvious structural patterns.\n\nEvery quantitative discovery below states its confidence grade, underlying assumptions, data provenance, and opposing interpretation. Underlying external filings, corporate fundamentals, and quarterly ownership tables retain their original analysis dates and reporting boundaries; a fund purchase or delivery surge organizes what to investigate next and never constitutes a standalone valuation clearance.`,
      stories,
      watchlist: [
        {
          title: "Unlisted Pre-IPO Valuation Marks",
          text: "Monitor quarterly mark-to-market disclosures for Zetwerk, Bonfiglioli, Rentomojo, Jio Platforms, and SFC Environmental across holding AMC fact sheets as listing pipelines progress.",
        },
        {
          title: "Pending AMC Reconciliations",
          text: period.missingFunds.length
            ? `Verified October disclosures remain pending for ${pendingNames}, alongside ${forensic.uncorroboratedRows} single-source provider positions flagged for corroboration.`
            : "All 34 schemes have October files; continue verifying corporate-action splits.",
        },
        {
          title: "Delivery vs. Earnings Proof",
          text: "Cross-check Q2 FY27 earnings cash conversion and working capital receivables for high-delivery accumulators (Redington, IPCA, Timken, Prudent, INOX India) against peak-cycle multiples.",
        },
      ],
      closing:
        "Forensic cross-referencing turns raw holdings into high-signal research leads; price, balance sheet durability, and operating cash flow still decide the investment.",
    },
  };
}
