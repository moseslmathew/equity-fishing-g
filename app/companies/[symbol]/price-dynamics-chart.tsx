"use client";

import { useState } from "react";
import { Gauge } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../components/ui/tooltip";

export interface PriceDynamicsChartProps {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  previousClose?: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  change30d: number | null;
  volume?: number | null;
}

const inr = (n: number | null | undefined) =>
  n == null
    ? "—"
    : "₹" +
      n.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

const pct = (n: number | null | undefined) =>
  n == null ? "—" : (n > 0 ? "+" : "") + n.toFixed(2) + "%";

export default function PriceDynamicsChart({
  symbol,
  price,
  change,
  changePercent,
  open,
  high,
  low,
  yearHigh,
  yearLow,
  change30d,
}: PriceDynamicsChartProps) {
  const [activeTab, setActiveTab] = useState<"session" | "52week">("session");

  // Calculate session metrics
  const sessionValid = low !== null && high !== null && high >= low;
  const sessionPos =
    sessionValid && price !== null && high > low
      ? Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100))
      : 50;

  const openPos =
    sessionValid && open !== null && high > low
      ? Math.max(0, Math.min(100, ((open - low) / (high - low)) * 100))
      : null;

  // Calculate 52-week metrics
  const yearValid = yearLow !== null && yearHigh !== null && yearHigh >= yearLow;
  const yearPos =
    yearValid && price !== null && yearHigh > yearLow
      ? Math.max(0, Math.min(100, ((price - yearLow) / (yearHigh - yearLow)) * 100))
      : 50;

  const fromHigh = price && yearHigh ? ((price - yearHigh) / yearHigh) * 100 : null;
  const fromLow = price && yearLow ? ((price - yearLow) / yearLow) * 100 : null;
  const sessionSpread = high && low && low > 0 ? ((high - low) / low) * 100 : null;

  const isPositive = (changePercent ?? 0) >= 0;

  return (
    <section className="company-panel company-price-chart" aria-label="Interactive Price Dynamics">
      <div className="volume-heading">
        <h2>
          <Gauge size={17} aria-hidden="true" />
          <span>Price & Range Dynamics</span>
        </h2>
        <span className="price-chart-symbol">NSE · {symbol}</span>
      </div>

      <div className="volume-tabs" role="group" aria-label="Price range view">
        <button
          type="button"
          aria-pressed={activeTab === "session"}
          onClick={() => setActiveTab("session")}
        >
          Session Range
        </button>
        <button
          type="button"
          aria-pressed={activeTab === "52week"}
          onClick={() => setActiveTab("52week")}
        >
          52-Week Range
        </button>
      </div>

      <div className="volume-comparison">
        <div className="volume-period-header">
          <div className="volume-period-label">
            {activeTab === "session"
              ? "Today's Trading Range & Spectrum"
              : "52-Week High–Low Band & Momentum"}
          </div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: isPositive ? "#16a34a" : "#dc2626",
            }}
          >
            {pct(changePercent)} ({inr(change)})
          </div>
        </div>

        <div className="volume-overview" style={{ alignItems: "stretch" }}>
          {/* Key Statistics */}
          <dl className="volume-statistics">
            <div>
              <dt>
                <i style={{ background: "#7043c1" }} />
                <span>Last Traded Price</span>
              </dt>
              <dd>{inr(price)}</dd>
            </div>
            {activeTab === "session" ? (
              <>
                <div>
                  <dt>
                    <i style={{ background: "#38bdf8" }} />
                    <span>Session Low / High</span>
                  </dt>
                  <dd>
                    {inr(low)} – {inr(high)}
                  </dd>
                </div>
                <div>
                  <dt>
                    <i style={{ background: "#94a3b8" }} />
                    <span>Opening Price</span>
                  </dt>
                  <dd>{inr(open)}</dd>
                </div>
                <div style={{ borderTop: "1px dashed var(--line)", paddingTop: "14px", marginTop: "14px" }}>
                  <dt>
                    <span>Session High–Low Spread</span>
                  </dt>
                  <dd>{sessionSpread !== null ? sessionSpread.toFixed(2) + "%" : "—"}</dd>
                </div>
              </>
            ) : (
              <>
                <div>
                  <dt>
                    <i style={{ background: "#38bdf8" }} />
                    <span>52-Week Low / High</span>
                  </dt>
                  <dd>
                    {inr(yearLow)} – {inr(yearHigh)}
                  </dd>
                </div>
                <div>
                  <dt>
                    <i style={{ background: (change30d ?? 0) >= 0 ? "#16a34a" : "#dc2626" }} />
                    <span>30-Day Momentum</span>
                  </dt>
                  <dd style={{ color: (change30d ?? 0) >= 0 ? "#16a34a" : "#dc2626" }}>
                    {pct(change30d)}
                  </dd>
                </div>
                <div style={{ borderTop: "1px dashed var(--line)", paddingTop: "14px", marginTop: "14px" }}>
                  <dt>
                    <span>From 52-Week High</span>
                  </dt>
                  <dd style={{ color: (fromHigh ?? 0) < 0 ? "#dc2626" : "inherit" }}>
                    {pct(fromHigh)}
                  </dd>
                </div>
              </>
            )}
          </dl>

          {/* Graphical Spectrum Gauge */}
          <TooltipProvider delayDuration={100}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: "16px 8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                  color: "var(--muted)",
                  marginBottom: "8px",
                }}
              >
                <span>
                  {activeTab === "session" ? "Session Low" : "52W Low"}:{" "}
                  <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
                    {inr(activeTab === "session" ? low : yearLow)}
                  </strong>
                </span>
                <span>
                  {activeTab === "session" ? "Session High" : "52W High"}:{" "}
                  <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
                    {inr(activeTab === "session" ? high : yearHigh)}
                  </strong>
                </span>
              </div>

              {/* Progress Spectrum Bar */}
              <div
                style={{
                  position: "relative",
                  height: "12px",
                  borderRadius: "6px",
                  background: "linear-gradient(90deg, #d8b4fe 0%, #7043c1 50%, #38bdf8 100%)",
                  margin: "12px 0 28px",
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1)",
                }}
              >
                {/* Current Price Pin */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      style={{
                        position: "absolute",
                        left: `${activeTab === "session" ? sessionPos : yearPos}%`,
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        background: "#ffffff",
                        border: "3px solid #7043c1",
                        boxShadow: "0 2px 8px rgba(112, 67, 193, 0.4)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: "#7043c1",
                        }}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    className="volume-tooltip"
                    side="top"
                    sideOffset={12}
                  >
                    <strong>Current LTP: {inr(price)}</strong>
                    <div style={{ fontSize: "11px", marginTop: "4px" }}>
                      Position: {(activeTab === "session" ? sessionPos : yearPos).toFixed(1)}% of range
                    </div>
                  </TooltipContent>
                </Tooltip>

                {/* Open Price Pointer (Session View) */}
                {activeTab === "session" && openPos !== null && (
                  <div
                    title={`Open: ${inr(open)}`}
                    style={{
                      position: "absolute",
                      left: `${openPos}%`,
                      top: "-6px",
                      width: "2px",
                      height: "24px",
                      background: "#334155",
                      borderRadius: "1px",
                    }}
                  />
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                  color: "var(--muted)",
                }}
              >
                <span>
                  {activeTab === "session"
                    ? `Spread: ${sessionSpread !== null ? sessionSpread.toFixed(1) + "%" : "—"}`
                    : `+${fromLow !== null ? fromLow.toFixed(1) + "%" : "—"} above low`}
                </span>
                <span>
                  Current: <strong style={{ color: "#7043c1" }}>{inr(price)}</strong>
                </span>
                <span>
                  {activeTab === "session"
                    ? `Open: ${inr(open)}`
                    : `${fromHigh !== null ? fromHigh.toFixed(1) + "%" : "—"} from high`}
                </span>
              </div>
            </div>
          </TooltipProvider>
        </div>
      </div>
    </section>
  );
}
