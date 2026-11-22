"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { ChartPoint, ChartResponse } from "../../api/nse/chart/route";
import "./stock-price-volume-chart.css";

export interface StockPriceVolumeChartProps {
  symbol: string;
  companyName?: string;
  currentPrice?: number | null;
  currentChange?: number | null;
  currentChangePercent?: number | null;
  eodDate?: string | null;
  eodVolume?: number | null;
}

type RangeOption = "5D" | "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "ALL";

const RANGES: { key: RangeOption; label: string }[] = [
  { key: "5D", label: "5D" },
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "6M", label: "6M" },
  { key: "1Y", label: "1Y" },
  { key: "3Y", label: "3Y" },
  { key: "5Y", label: "5Y" },
  { key: "ALL", label: "All" },
];

const formatInr = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n)) return "—";
  return (
    "₹" +
    n.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
};

const formatVolumeRaw = (v: number | null | undefined) => {
  if (v == null || !Number.isFinite(v) || v <= 0) return "—";
  return v.toLocaleString("en-IN");
};

const formatTickDate = (timestampSec: number) => {
  const d = new Date(timestampSec * 1000);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
};

const formatTooltipDate = (timestampSec: number) => {
  const d = new Date(timestampSec * 1000);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
};

export default function StockPriceVolumeChart({
  symbol,
  companyName,
  currentPrice: initialPrice,
  currentChange: initialChange,
  currentChangePercent: initialChangePercent,
  eodDate,
  eodVolume,
}: StockPriceVolumeChartProps) {
  const [range, setRange] = useState<RangeOption>("1M");
  const [data, setData] = useState<ChartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartId = useId().replace(/:/g, "_");

  // Fetch chart data when symbol or range changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    fetch(`/api/nse/chart?symbol=${encodeURIComponent(symbol)}&range=${range}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error || `Unable to load ${range} chart data`);
        }
        return res.json() as Promise<ChartResponse>;
      })
      .then((resData) => {
        if (cancelled) return;
        setData(resData);
        setHoverIndex(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load chart");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  const points = data?.points || [];

  // Derived metrics and bounds for SVG layout
  const {
    minPrice,
    maxPrice,
    priceRange,
    maxVolume,
    highPoint,
    lowPoint,
    periodChangePercent,
    isPositive,
  } = useMemo(() => {
    if (!points.length) {
      return {
        minPrice: 0,
        maxPrice: 100,
        priceRange: 100,
        maxVolume: 1,
        highPoint: null,
        lowPoint: null,
        periodChangePercent: initialChangePercent ?? 0,
        isPositive: (initialChangePercent ?? 0) >= 0,
      };
    }

    let min = Infinity;
    let max = -Infinity;
    let maxVol = 0;
    let hIdx = 0;
    let lIdx = 0;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p.low < min) {
        min = p.low;
        lIdx = i;
      }
      if (p.high > max) {
        max = p.high;
        hIdx = i;
      }
      if (p.volume > maxVol) {
        maxVol = p.volume;
      }
    }

    // Add breathing room to top and bottom
    const pad = (max - min) * 0.08 || max * 0.05 || 1;
    const paddedMin = Math.max(0, min - pad);
    const paddedMax = max + pad;
    const pRange = paddedMax - paddedMin || 1;

    const firstClose = points[0]?.close ?? 0;
    const lastClose = points[points.length - 1]?.close ?? 0;
    const pct = data?.meta?.periodChangePercent ?? (firstClose > 0 ? ((lastClose / firstClose) - 1) * 100 : 0);

    return {
      minPrice: paddedMin,
      maxPrice: paddedMax,
      priceRange: pRange,
      maxVolume: maxVol || 1,
      highPoint: { point: points[hIdx], index: hIdx },
      lowPoint: { point: points[lIdx], index: lIdx },
      periodChangePercent: pct,
      isPositive: pct >= 0,
    };
  }, [points, data?.meta?.periodChangePercent, initialChangePercent]);

  // SVG coordinate dimensions
  const svgWidth = 1000;
  const svgHeight = 440;
  const paddingLeft = 16;
  const paddingRight = 78; // Space for right Y-axis price labels
  const chartWidth = svgWidth - paddingLeft - paddingRight;

  const priceTop = 26;
  const priceHeight = 250;
  const priceBottom = priceTop + priceHeight; // 276

  const volumeTop = 295;
  const volumeHeight = 90;
  const volumeBottom = volumeTop + volumeHeight; // 385

  const timeAxisY = 418;

  const getX = (index: number) => {
    if (points.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (points.length - 1)) * chartWidth;
  };

  const getY = (price: number) => {
    return priceBottom - ((price - minPrice) / priceRange) * priceHeight;
  };

  const getVolY = (volume: number) => {
    const barH = (volume / maxVolume) * volumeHeight;
    return volumeBottom - barH;
  };

  // Generate SVG path for line/area chart
  const { linePath, areaPath } = useMemo(() => {
    if (!points.length) return { linePath: "", areaPath: "" };
    if (points.length === 1) {
      const x = getX(0);
      const y = getY(points[0].close);
      return {
        linePath: `M ${x - 20} ${y} L ${x + 20} ${y}`,
        areaPath: `M ${x - 20} ${y} L ${x + 20} ${y} L ${x + 20} ${priceBottom} L ${x - 20} ${priceBottom} Z`,
      };
    }

    const firstX = getX(0);
    const firstY = getY(points[0].close);
    let d = `M ${firstX} ${firstY}`;

    for (let i = 1; i < points.length; i++) {
      const x = getX(i);
      const y = getY(points[i].close);
      d += ` L ${x} ${y}`;
    }

    const lastX = getX(points.length - 1);
    const area = `${d} L ${lastX} ${priceBottom} L ${firstX} ${priceBottom} Z`;

    return { linePath: d, areaPath: area };
  }, [points, minPrice, priceRange]);

  // 5 Evenly spaced right-axis price lines
  const axisTicks = useMemo(() => {
    if (!points.length) return [];
    const ticks: { price: number; y: number }[] = [];
    for (let i = 0; i <= 4; i++) {
      const p = minPrice + (priceRange / 4) * i;
      ticks.push({
        price: p,
        y: priceBottom - (priceHeight / 4) * i,
      });
    }
    return ticks;
  }, [minPrice, priceRange, priceBottom, priceHeight, points.length]);

  // Evenly spaced X-axis date ticks
  const timeTicks = useMemo(() => {
    if (!points.length) return [];
    const count = points.length;
    if (count <= 1) {
      return [{ x: paddingLeft + chartWidth / 2, label: formatTickDate(points[0].time) }];
    }
    const maxTicks = 10;
    const step = Math.max(1, Math.floor((count - 1) / maxTicks));
    const ticks: { x: number; label: string }[] = [];
    for (let i = 0; i < count; i += step) {
      ticks.push({
        x: getX(i),
        label: formatTickDate(points[i].time),
      });
    }
    if (ticks[ticks.length - 1].x !== getX(count - 1)) {
      ticks.push({
        x: getX(count - 1),
        label: formatTickDate(points[count - 1].time),
      });
    }
    return ticks;
  }, [points, chartWidth, paddingLeft]);

  // Mouse interaction for crosshair and scrub
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!points.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xClient = e.clientX - rect.left;
    const xSvg = (xClient / rect.width) * svgWidth;
    const clampedX = Math.max(paddingLeft, Math.min(paddingLeft + chartWidth, xSvg));
    const ratio = (clampedX - paddingLeft) / chartWidth;
    const idx = Math.round(ratio * (points.length - 1));
    setHoverIndex(Math.max(0, Math.min(points.length - 1, idx)));
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const activePoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : null;

  // Latest closing and volume for bottom card
  const latestPoint = points.length ? points[points.length - 1] : null;
  const latestClose = initialPrice ?? latestPoint?.close ?? null;
  const latestVolume = eodVolume ?? latestPoint?.volume ?? null;
  const latestDateLabel = eodDate
    ? formatTooltipDate(Date.parse(eodDate) / 1000)
    : latestPoint
    ? formatTooltipDate(latestPoint.time)
    : "Latest session";

  const strokeColor = "#059669"; // Emerald green
  const gradientId = `grad_${chartId}`;

  return (
    <div className="stock-chart-card" ref={containerRef}>
      {/* 1. Timeframe Pills and Period Stats (Same Row) */}
      <div className="stock-chart-toolbar-row">
        <div className="stock-chart-pills" role="tablist" aria-label="Timeframe">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={range === r.key}
              className={`stock-chart-pill ${range === r.key ? "is-selected" : ""}`}
              onClick={() => setRange(r.key)}
              disabled={loading}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="stock-chart-stats-row">
          <div className="stock-chart-stat-item">
            <span className="stock-chart-stat-label">Change</span>
            <span
              className={`stock-chart-change-pill ${
                isPositive ? "is-positive" : "is-negative"
              }`}
            >
              {periodChangePercent >= 0 ? "+" : ""}
              {periodChangePercent.toFixed(2)}%
            </span>
          </div>

          <div className="stock-chart-stat-item">
            <span className="stock-chart-stat-label">High</span>
            <strong className="stock-chart-stat-val">
              {formatInr(highPoint?.point ? highPoint.point.high : data?.meta?.periodHigh)}
            </strong>
          </div>

          <div className="stock-chart-stat-item">
            <span className="stock-chart-stat-label">Low</span>
            <strong className="stock-chart-stat-val">
              {formatInr(lowPoint?.point ? lowPoint.point.low : data?.meta?.periodLow)}
            </strong>
          </div>
        </div>
      </div>

      {/* 2. Interactive SVG Canvas Viewport */}
      <div className="stock-chart-viewport" aria-busy={loading}>
        {loading && (
          <div className="stock-chart-loading-overlay">
            <RefreshCw size={22} className="company-spinning" />
            <span>Updating {range} chart…</span>
          </div>
        )}

        {error ? (
          <div className="stock-chart-error-state" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setRange(range)}>
              Retry
            </button>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="stock-chart-svg"
            preserveAspectRatio="none"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#059669" stopOpacity="0.18" />
                <stop offset="90%" stopColor="#059669" stopOpacity="0.01" />
                <stop offset="100%" stopColor="#059669" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines & Right Axis Price Labels */}
            {axisTicks.map((tick, idx) => (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={tick.y}
                  x2={paddingLeft + chartWidth}
                  y2={tick.y}
                  className="stock-chart-gridline"
                />
                <text
                  x={svgWidth - 10}
                  y={tick.y + 3.5}
                  textAnchor="end"
                  className="stock-chart-axis-price"
                >
                  ₹{tick.price >= 1000 ? tick.price.toFixed(1) : tick.price.toFixed(2)}
                </text>
              </g>
            ))}

            {/* Separator Line between Price and Volume Panes */}
            <line
              x1={paddingLeft}
              y1={volumeTop - 10}
              x2={paddingLeft + chartWidth}
              y2={volumeTop - 10}
              stroke="#e2e8f0"
              strokeWidth="0.8"
            />

            {/* Price Area Fill & Line */}
            <path d={areaPath} fill={`url(#${gradientId})`} />
            <path
              d={linePath}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Dotted Line & Marker for Peak High */}
            {highPoint && highPoint.point && (
              <g className="stock-chart-peak-group">
                <line
                  x1={getX(highPoint.index)}
                  y1={getY(highPoint.point.high)}
                  x2={paddingLeft + chartWidth}
                  y2={getY(highPoint.point.high)}
                  stroke="#cbd5e1"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={getX(highPoint.index)}
                  cy={getY(highPoint.point.high)}
                  r="4"
                  fill="#059669"
                />
                <text
                  x={getX(highPoint.index) - 8}
                  y={getY(highPoint.point.high) - 9}
                  textAnchor="end"
                  className="stock-chart-peak-text is-high"
                >
                  ₹{highPoint.point.high.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </text>
              </g>
            )}

            {/* Dotted Line & Marker for Valley Low */}
            {lowPoint && lowPoint.point && (
              <g className="stock-chart-valley-group">
                <line
                  x1={getX(lowPoint.index)}
                  y1={getY(lowPoint.point.low)}
                  x2={paddingLeft + chartWidth}
                  y2={getY(lowPoint.point.low)}
                  stroke="#cbd5e1"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={getX(lowPoint.index)}
                  cy={getY(lowPoint.point.low)}
                  r="4"
                  fill="#ef4444"
                />
                <text
                  x={getX(lowPoint.index) + 8}
                  y={getY(lowPoint.point.low) + 16}
                  textAnchor="start"
                  className="stock-chart-peak-text is-low"
                >
                  ₹{lowPoint.point.low.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </text>
              </g>
            )}

            {/* Volume Histogram Bars */}
            <g className="stock-chart-volume-bars">
              {points.map((p, idx) => {
                const x = getX(idx);
                const isUp = p.close >= p.open;
                const barColor = isUp ? "#10b981" : "#f87171";
                const barY = getVolY(p.volume);
                const barHeight = Math.max(1.5, volumeBottom - barY);
                const barWidth = Math.max(2, Math.min(10, (chartWidth / points.length) * 0.72));

                return (
                  <rect
                    key={idx}
                    x={x - barWidth / 2}
                    y={barY}
                    width={barWidth}
                    height={barHeight}
                    fill={barColor}
                    opacity={hoverIndex === idx ? 0.95 : 0.65}
                    rx="1.5"
                  />
                );
              })}
            </g>

            {/* X-Axis Date Labels along bottom */}
            {timeTicks.map((tick, idx) => (
              <text
                key={idx}
                x={tick.x}
                y={timeAxisY}
                textAnchor={idx === 0 ? "start" : idx === timeTicks.length - 1 ? "end" : "middle"}
                className="stock-chart-date-tick"
              >
                {tick.label}
              </text>
            ))}

            {/* Crosshair Line & Point on Scrub */}
            {hoverIndex !== null && points[hoverIndex] && (
              <g className="stock-chart-hover-marker">
                <line
                  x1={getX(hoverIndex)}
                  y1={priceTop}
                  x2={getX(hoverIndex)}
                  y2={volumeBottom}
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={getX(hoverIndex)}
                  cy={getY(points[hoverIndex].close)}
                  r="4.5"
                  fill="#059669"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>
        )}

        {/* 3. Floating Tooltip Card on Scrub */}
        {activePoint && hoverIndex !== null && (
          <div
            className="stock-chart-floating-tooltip"
            style={{
              left: `${Math.min(78, Math.max(14, (getX(hoverIndex) / svgWidth) * 100))}%`,
              top: `${Math.min(52, Math.max(12, (getY(activePoint.close) / svgHeight) * 100 - 15))}%`,
            }}
          >
            <div className="stock-chart-tooltip-date">
              {formatTooltipDate(activePoint.time)}
            </div>
            <div className="stock-chart-tooltip-row">
              <span className="stock-chart-tooltip-lbl">Close</span>
              <strong className="stock-chart-tooltip-val">
                {formatInr(activePoint.close)}
              </strong>
            </div>
            <div className="stock-chart-tooltip-row">
              <span className="stock-chart-tooltip-lbl">Volume</span>
              <strong className="stock-chart-tooltip-val">
                {formatVolumeRaw(activePoint.volume)}
              </strong>
            </div>
          </div>
        )}
      </div>

      {/* 4. Bottom Summary Card (Close, Volume, NSE Bhavcopy note) */}
      <div className="stock-chart-bottom-summary">
        <div className="stock-chart-summary-date">{latestDateLabel}</div>
        <div className="stock-chart-summary-card">
          <div className="stock-chart-summary-col">
            <span className="stock-chart-summary-lbl">CLOSE</span>
            <span className="stock-chart-summary-val">{formatInr(latestClose)}</span>
          </div>
          <div className="stock-chart-summary-col">
            <span className="stock-chart-summary-lbl">VOLUME</span>
            <span className="stock-chart-summary-val">{formatVolumeRaw(latestVolume)}</span>
          </div>
        </div>
        <p className="stock-chart-summary-note">
          NSE Bhavcopy · Daily closes and traded volume · Prices are unadjusted for corporate actions
        </p>
      </div>
    </div>
  );
}
