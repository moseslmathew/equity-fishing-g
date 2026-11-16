"use client";

import { useMemo, useState } from "react";
import { BarChart3, Lightbulb, PieChart, TrendingUp } from "lucide-react";
import type { Fund } from "../lib/portfolio";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import "./fund-chart.css";

export type FundChartView = "top10" | "changes" | "concentration";

interface FundChartProps {
  fund: Fund;
  previousFund?: Fund;
  priorWeight: (name: string) => number | null;
  requestedMonth: string;
  previousMonth: string;
}

function shortLabel(name: string): string {
  const cleaned = name
    .replace(
      /\s+(Limited|Ltd\.?|Private|Pvt\.?|Corp\.?|Corporation|India|Industries|Enterprises|Holdings)\b/gi,
      ""
    )
    .trim();
  const words = cleaned.split(/\s+/);
  if (words.length <= 2) return cleaned;
  return words.slice(0, 2).join(" ");
}

const pct = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : n.toFixed(2) + "%";

const pp = (n: number | null | undefined) => {
  if (n === null || n === undefined) return "—";
  return (n > 0 ? "+" : "") + n.toFixed(2) + " pp";
};

const monthLabel = (m: string) =>
  new Date(m + "-01T00:00:00Z").toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

export default function FundChart({
  fund,
  priorWeight,
  requestedMonth,
  previousMonth,
}: FundChartProps) {
  const [view, setView] = useState<FundChartView>("top10");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  // Compute enriched holdings data
  const enrichedHoldings = useMemo(() => {
    return fund.holdings.map((h, idx) => {
      const prev = priorWeight(h.name);
      const change = prev !== null ? Math.round((h.weight - prev) * 100) / 100 : null;
      return {
        key: h.key || `${h.name}-${idx}`,
        name: h.name,
        shortName: shortLabel(h.name),
        weight: h.weight,
        previousWeight: prev,
        change,
        rank: idx + 1,
      };
    });
  }, [fund.holdings, priorWeight]);

  // Top 10 items for the primary view
  const top10 = useMemo(() => enrichedHoldings.slice(0, 10), [enrichedHoldings]);

  // Holdings with changes for the changes view
  const changesList = useMemo(() => {
    return [...enrichedHoldings]
      .filter((h) => h.change !== null && Math.abs(h.change) >= 0.01)
      .sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0))
      .slice(0, 8);
  }, [enrichedHoldings]);

  // Concentration tiers
  const concentrationTiers = useMemo(() => {
    const top3Weight = top10.slice(0, 3).reduce((sum, h) => sum + h.weight, 0);
    const top45Weight = top10.slice(3, 5).reduce((sum, h) => sum + h.weight, 0);
    const top610Weight = top10.slice(5, 10).reduce((sum, h) => sum + h.weight, 0);
    const totalTop = enrichedHoldings.reduce((sum, h) => sum + h.weight, 0);
    const remainder = Math.max(0, totalTop - (top3Weight + top45Weight + top610Weight));

    return [
      { key: "tier-1", label: "Top 1–3", weight: top3Weight, count: 3 },
      { key: "tier-2", label: "Ranks 4–5", weight: top45Weight, count: 2 },
      { key: "tier-3", label: "Ranks 6–10", weight: top610Weight, count: 5 },
      {
        key: "tier-4",
        label: `Ranks 11–${enrichedHoldings.length}`,
        weight: remainder,
        count: Math.max(0, enrichedHoldings.length - 10),
      },
    ];
  }, [top10, enrichedHoldings]);

  // High-level statistics
  const top5Weight = useMemo(
    () => top10.slice(0, 5).reduce((sum, h) => sum + h.weight, 0),
    [top10]
  );
  const top10Weight = useMemo(
    () => top10.reduce((sum, h) => sum + h.weight, 0),
    [top10]
  );
  const largestHolding = top10[0];

  const increases = useMemo(
    () => enrichedHoldings.filter((h) => h.change !== null && h.change > 0),
    [enrichedHoldings]
  );
  const decreases = useMemo(
    () => enrichedHoldings.filter((h) => h.change !== null && h.change < 0),
    [enrichedHoldings]
  );

  const largestIncrease = useMemo(() => {
    if (!increases.length) return null;
    return [...increases].sort((a, b) => (b.change ?? 0) - (a.change ?? 0))[0];
  }, [increases]);

  const largestDecrease = useMemo(() => {
    if (!decreases.length) return null;
    return [...decreases].sort((a, b) => (a.change ?? 0) - (b.change ?? 0))[0];
  }, [decreases]);

  // Active highlighted holding
  const activeKey = previewKey ?? selectedKey;
  const activeHolding = useMemo(() => {
    if (!activeKey) return null;
    return enrichedHoldings.find((h) => h.key === activeKey) ?? null;
  }, [activeKey, enrichedHoldings]);

  // Max value for chart scaling
  const maxTop10 = useMemo(() => {
    const vals = top10.flatMap((h) => [h.weight, h.previousWeight ?? 0]);
    return Math.max(1, ...vals);
  }, [top10]);

  const maxChange = useMemo(() => {
    if (!changesList.length) return 1;
    return Math.max(1, ...changesList.map((h) => Math.abs(h.change ?? 0)));
  }, [changesList]);

  const maxConcentration = useMemo(() => {
    return Math.max(1, ...concentrationTiers.map((t) => t.weight));
  }, [concentrationTiers]);

  // Automated financial insights
  const insights = useMemo(() => {
    const items: string[] = [];

    // 1. Conviction
    if (top5Weight >= 30) {
      items.push(
        `High portfolio concentration: Top 5 holdings account for ${top5Weight.toFixed(2)}% of assets.`
      );
    } else {
      items.push(
        `Balanced risk profile: Top 5 holdings account for ${top5Weight.toFixed(2)}% of assets.`
      );
    }

    // 2. Largest addition
    if (largestIncrease && largestIncrease.change !== null && largestIncrease.change > 0) {
      items.push(
        `Highest addition: ${largestIncrease.name} increased by +${largestIncrease.change.toFixed(2)} pp to ${largestIncrease.weight.toFixed(2)}%.`
      );
    }

    // 3. Largest reduction
    if (largestDecrease && largestDecrease.change !== null && largestDecrease.change < 0) {
      items.push(
        `Notable reduction: ${largestDecrease.name} trimmed by ${largestDecrease.change.toFixed(2)} pp.`
      );
    }

    // 4. Anchor position
    if (largestHolding) {
      items.push(
        `Anchor position: ${largestHolding.name} leads at ${largestHolding.weight.toFixed(2)}% allocation.`
      );
    }

    return items;
  }, [top5Weight, largestIncrease, largestDecrease, largestHolding]);

  return (
    <section
      className="fund-chart-panel"
      aria-label={`${fund.name} portfolio allocation chart`}
    >
      <div className="fund-chart-heading">
        <h3>
          <BarChart3 size={17} aria-hidden="true" />
          <span>Portfolio Allocation & Dynamics</span>
        </h3>
        <span className="fund-chart-period">
          {monthLabel(requestedMonth)} vs {monthLabel(previousMonth)}
        </span>
      </div>

      <div className="fund-chart-tabs" role="group" aria-label="Chart view mode">
        <button
          type="button"
          className="fund-chart-tab"
          aria-pressed={view === "top10"}
          onClick={() => {
            setView("top10");
            setSelectedKey(null);
            setPreviewKey(null);
          }}
        >
          <BarChart3 size={13} aria-hidden="true" />
          <span>Top 10 Holdings</span>
        </button>
        <button
          type="button"
          className="fund-chart-tab"
          aria-pressed={view === "changes"}
          onClick={() => {
            setView("changes");
            setSelectedKey(null);
            setPreviewKey(null);
          }}
        >
          <TrendingUp size={13} aria-hidden="true" />
          <span>Allocation Changes</span>
        </button>
        <button
          type="button"
          className="fund-chart-tab"
          aria-pressed={view === "concentration"}
          onClick={() => {
            setView("concentration");
            setSelectedKey(null);
            setPreviewKey(null);
          }}
        >
          <PieChart size={13} aria-hidden="true" />
          <span>Concentration</span>
        </button>
      </div>

      <div className="fund-chart-comparison">
        <div className="fund-chart-period-header">
          <span className="fund-chart-period-label">
            {activeHolding
              ? activeHolding.name
              : view === "top10"
              ? `Top 10 Holdings · ${monthLabel(requestedMonth)} vs ${monthLabel(previousMonth)}`
              : view === "changes"
              ? `Largest Allocation Movements · Percentage Points`
              : `Concentration Tiers · Disclosed Portfolio`}
          </span>
          {activeHolding && (
            <button
              type="button"
              className="fund-chart-reset-btn"
              onClick={() => {
                setSelectedKey(null);
                setPreviewKey(null);
              }}
            >
              Reset view
            </button>
          )}
        </div>

        <div className="fund-chart-overview">
          {/* Dynamic Statistics Block */}
          <dl className="fund-chart-statistics">
            {activeHolding ? (
              <>
                <div>
                  <dt>
                    <i className="dot-current" aria-hidden="true" />
                    <span>{monthLabel(requestedMonth)} Allocation</span>
                  </dt>
                  <dd>{pct(activeHolding.weight)}</dd>
                </div>
                <div>
                  <dt>
                    <i className="dot-previous" aria-hidden="true" />
                    <span>{monthLabel(previousMonth)} Allocation</span>
                  </dt>
                  <dd>{pct(activeHolding.previousWeight)}</dd>
                </div>
                <div className="fund-stat-divider">
                  <dt>
                    <span>Net Allocation Change</span>
                  </dt>
                  <dd
                    style={{
                      color:
                        (activeHolding.change ?? 0) > 0
                          ? "#16a34a"
                          : (activeHolding.change ?? 0) < 0
                          ? "#dc2626"
                          : "inherit",
                    }}
                  >
                    {pp(activeHolding.change)}
                  </dd>
                </div>
              </>
            ) : view === "changes" ? (
              <>
                <div>
                  <dt>
                    <i className="dot-increase" aria-hidden="true" />
                    <span>Allocations Increased</span>
                  </dt>
                  <dd>{increases.length} positions</dd>
                </div>
                <div>
                  <dt>
                    <i className="dot-decrease" aria-hidden="true" />
                    <span>Allocations Trimmed</span>
                  </dt>
                  <dd>{decreases.length} positions</dd>
                </div>
                <div className="fund-stat-divider">
                  <dt>
                    <span>Largest Addition</span>
                  </dt>
                  <dd style={{ color: "#16a34a" }}>
                    {largestIncrease
                      ? `${largestIncrease.shortName} (${pp(largestIncrease.change)})`
                      : "None"}
                  </dd>
                </div>
              </>
            ) : view === "concentration" ? (
              <>
                <div>
                  <dt>
                    <i className="dot-current" aria-hidden="true" />
                    <span>Top 3 Holdings Weight</span>
                  </dt>
                  <dd>{pct(concentrationTiers[0].weight)}</dd>
                </div>
                <div>
                  <dt>
                    <i className="dot-previous" aria-hidden="true" />
                    <span>Top 5 Holdings Weight</span>
                  </dt>
                  <dd>{pct(top5Weight)}</dd>
                </div>
                <div className="fund-stat-divider">
                  <dt>
                    <span>Top 10 Holdings Weight</span>
                  </dt>
                  <dd>{pct(top10Weight)}</dd>
                </div>
              </>
            ) : (
              <>
                <div>
                  <dt>
                    <i className="dot-current" aria-hidden="true" />
                    <span>Top 5 Holdings Weight</span>
                  </dt>
                  <dd>{pct(top5Weight)}</dd>
                </div>
                <div>
                  <dt>
                    <i className="dot-previous" aria-hidden="true" />
                    <span>Top 10 Holdings Weight</span>
                  </dt>
                  <dd>{pct(top10Weight)}</dd>
                </div>
                <div className="fund-stat-divider">
                  <dt>
                    <span>Anchor Position</span>
                  </dt>
                  <dd>
                    {largestHolding
                      ? `${largestHolding.shortName} (${pct(largestHolding.weight)})`
                      : "Unavailable"}
                  </dd>
                </div>
              </>
            )}
          </dl>

          {/* Interactive Chart Canvas */}
          <TooltipProvider delayDuration={80}>
            <div
              className="fund-paired-chart"
              role="group"
              aria-label="Select a bar to view holding details"
            >
              {view === "top10" &&
                top10.map((h) => {
                  const isSelected = selectedKey === h.key;
                  const currentHeight = Math.max(2, (h.weight / maxTop10) * 100);
                  const prevHeight =
                    h.previousWeight !== null
                      ? Math.max(2, (h.previousWeight / maxTop10) * 100)
                      : 0;

                  return (
                    <Tooltip key={h.key}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className={`fund-chart-group ${isSelected ? "is-selected" : ""}`}
                          aria-label={`${h.name}, ${pct(h.weight)}`}
                          aria-pressed={isSelected}
                          onMouseEnter={() => setPreviewKey(h.key)}
                          onMouseLeave={() => setPreviewKey(null)}
                          onFocus={() => setPreviewKey(h.key)}
                          onBlur={() => setPreviewKey(null)}
                          onClick={() => setSelectedKey(isSelected ? null : h.key)}
                        >
                          <div className="fund-paired-bars">
                            <span
                              className="fund-current-bar"
                              style={{ height: `${currentHeight}%` }}
                            />
                            <span
                              className="fund-previous-bar"
                              style={{ height: `${prevHeight}%` }}
                            />
                          </div>
                          <span className="fund-bar-label" title={h.name}>
                            {h.shortName}
                            <small>{pct(h.weight)}</small>
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="fund-chart-tooltip" side="top" sideOffset={10}>
                        <div className="fund-chart-tooltip-title">
                          #{h.rank} {h.name}
                        </div>
                        <div className="fund-chart-tooltip-grid">
                          <span>{monthLabel(requestedMonth)}:</span>
                          <span>{pct(h.weight)}</span>
                          <span>{monthLabel(previousMonth)}:</span>
                          <span>{pct(h.previousWeight)}</span>
                          <span>Change:</span>
                          <span
                            className={
                              (h.change ?? 0) > 0 ? "pos" : (h.change ?? 0) < 0 ? "neg" : ""
                            }
                          >
                            {pp(h.change)}
                          </span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}

              {view === "changes" &&
                (changesList.length > 0 ? (
                  changesList.map((h) => {
                    const isSelected = selectedKey === h.key;
                    const changeVal = h.change ?? 0;
                    const barHeight = Math.max(4, (Math.abs(changeVal) / maxChange) * 100);
                    const isPositive = changeVal > 0;

                    return (
                      <Tooltip key={h.key}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className={`fund-chart-group ${isSelected ? "is-selected" : ""}`}
                            aria-label={`${h.name}, change ${pp(h.change)}`}
                            aria-pressed={isSelected}
                            onMouseEnter={() => setPreviewKey(h.key)}
                            onMouseLeave={() => setPreviewKey(null)}
                            onFocus={() => setPreviewKey(h.key)}
                            onBlur={() => setPreviewKey(null)}
                            onClick={() => setSelectedKey(isSelected ? null : h.key)}
                          >
                            <div className="fund-paired-bars">
                              <span
                                className={
                                  isPositive ? "fund-change-pos-bar" : "fund-change-neg-bar"
                                }
                                style={{ height: `${barHeight}%` }}
                              />
                            </div>
                            <span className="fund-bar-label" title={h.name}>
                              {h.shortName}
                              <small style={{ color: isPositive ? "#16a34a" : "#dc2626" }}>
                                {pp(h.change)}
                              </small>
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          className="fund-chart-tooltip"
                          side="top"
                          sideOffset={10}
                        >
                          <div className="fund-chart-tooltip-title">{h.name}</div>
                          <div className="fund-chart-tooltip-grid">
                            <span>Allocation Change:</span>
                            <span className={isPositive ? "pos" : "neg"}>
                              {pp(h.change)}
                            </span>
                            <span>Current Weight:</span>
                            <span>{pct(h.weight)}</span>
                            <span>Prior Weight:</span>
                            <span>{pct(h.previousWeight)}</span>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })
                ) : (
                  <div
                    style={{
                      width: "100%",
                      textAlign: "center",
                      padding: "24px 0",
                      color: "#7e668b",
                      fontSize: "12px",
                    }}
                  >
                    No significant allocation changes recorded for this reporting period.
                  </div>
                ))}

              {view === "concentration" &&
                concentrationTiers.map((tier) => {
                  const barHeight = Math.max(
                    3,
                    (tier.weight / maxConcentration) * 100
                  );

                  return (
                    <Tooltip key={tier.key}>
                      <TooltipTrigger asChild>
                        <div
                          className="fund-chart-group"
                          aria-label={`${tier.label}, ${pct(tier.weight)}`}
                        >
                          <div className="fund-paired-bars">
                            <span
                              className="fund-current-bar"
                              style={{ height: `${barHeight}%`, maxWidth: "34px" }}
                            />
                          </div>
                          <span className="fund-bar-label">
                            {tier.label}
                            <small>{pct(tier.weight)}</small>
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="fund-chart-tooltip" side="top" sideOffset={10}>
                        <div className="fund-chart-tooltip-title">{tier.label}</div>
                        <div className="fund-chart-tooltip-grid">
                          <span>Holding Count:</span>
                          <span>{tier.count} companies</span>
                          <span>Combined Weight:</span>
                          <span>{pct(tier.weight)}</span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
            </div>
          </TooltipProvider>
        </div>

        {/* Insights Box */}
        <div className="fund-insights">
          <h4>
            <Lightbulb size={13} aria-hidden="true" />
            <span>Fund Insights</span>
          </h4>
          <ul>
            {insights.map((text, i) => (
              <li key={i}>{text}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
