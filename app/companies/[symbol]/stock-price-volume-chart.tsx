"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Calendar,
  CandlestickChart,
  LineChart as LineChartIcon,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Volume2,
} from "lucide-react";
import type { ChartPoint, ChartResponse } from "../../api/nse/chart/route";

export interface StockPriceVolumeChartProps {
  symbol: string;
  companyName?: string;
  currentPrice?: number | null;
  currentChange?: number | null;
  currentChangePercent?: number | null;
}

type RangeOption = "1D" | "5D" | "1M" | "6M" | "1Y" | "5Y" | "ALL";
type ChartType = "area" | "candles";

const RANGES: { key: RangeOption; label: string }[] = [
  { key: "1D", label: "1D" },
  { key: "5D", label: "5D" },
  { key: "1M", label: "1M" },
  { key: "6M", label: "6M" },
  { key: "1Y", label: "1Y" },
  { key: "5Y", label: "5Y" },
  { key: "ALL", label: "MAX" },
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

const formatVolume = (v: number | null | undefined) => {
  if (v == null || !Number.isFinite(v) || v <= 0) return "0";
  if (v >= 10_000_000) return (v / 10_000_000).toFixed(2) + " Cr";
  if (v >= 100_000) return (v / 100_000).toFixed(2) + " L";
  if (v >= 1_000) return (v / 1_000).toFixed(1) + " K";
  return v.toLocaleString("en-IN");
};

const formatDateLabel = (timestampSec: number, range: RangeOption) => {
  const date = new Date(timestampSec * 1000);
  if (range === "1D") {
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  }
  if (range === "5D") {
    return (
      date.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      }) +
      " " +
      date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      })
    );
  }
  if (range === "1M" || range === "6M" || range === "1Y") {
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  }
  return date.toLocaleDateString("en-IN", {
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
}: StockPriceVolumeChartProps) {
  const [range, setRange] = useState<RangeOption>("1Y");
  const [chartType, setChartType] = useState<ChartType>("area");
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
    isPositivePeriod,
    highPoint,
    lowPoint,
  } = useMemo(() => {
    if (!points.length) {
      return {
        minPrice: 0,
        maxPrice: 100,
        priceRange: 100,
        maxVolume: 100,
        isPositivePeriod: true,
        highPoint: null,
        lowPoint: null,
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

    // Add 4% padding to top and bottom of price chart for breathing room
    const padding = (max - min) * 0.05 || max * 0.05 || 1;
    const paddedMin = Math.max(0, min - padding);
    const paddedMax = max + padding;
    const pRange = paddedMax - paddedMin || 1;

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const isUp = (lastPoint?.close ?? 0) >= (firstPoint?.close ?? 0);

    return {
      minPrice: paddedMin,
      maxPrice: paddedMax,
      priceRange: pRange,
      maxVolume: maxVol || 1,
      isPositivePeriod: isUp,
      highPoint: { point: points[hIdx], index: hIdx },
      lowPoint: { point: points[lIdx], index: lIdx },
    };
  }, [points]);

  // SVG dimensions
  const svgWidth = 1000;
  const svgHeight = 440;
  const paddingLeft = 16;
  const paddingRight = 72; // Space for right Y-axis price labels
  const chartWidth = svgWidth - paddingLeft - paddingRight;

  const priceTop = 24;
  const priceHeight = 260; // 24 to 284
  const priceBottom = priceTop + priceHeight;

  const volumeTop = 304;
  const volumeHeight = 90; // 304 to 394
  const volumeBottom = volumeTop + volumeHeight;

  const timeAxisY = 422;

  // Coordinate helper functions
  const getX = (index: number) => {
    if (points.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (points.length - 1)) * chartWidth;
  };

  const getY = (price: number) => {
    return priceBottom - ((price - minPrice) / priceRange) * priceHeight;
  };

  const getVolY = (volume: number) => {
    const barHeight = (volume / maxVolume) * volumeHeight;
    return volumeBottom - barHeight;
  };

  // Generate SVG path for line/area chart
  const { linePath, areaPath } = useMemo(() => {
    if (!points.length) return { linePath: "", areaPath: "" };

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

  // Horizontal price grid lines (4 lines across the price pane)
  const priceGridLines = useMemo(() => {
    const lines: { y: number; price: number }[] = [];
    const count = 4;
    for (let i = 0; i <= count; i++) {
      const price = minPrice + (priceRange / count) * i;
      const y = getY(price);
      lines.push({ y, price });
    }
    return lines;
  }, [minPrice, priceRange]);

  // Time axis ticks (5 ticks along the bottom)
  const timeTicks = useMemo(() => {
    if (!points.length) return [];
    const count = Math.min(6, points.length);
    const ticks: { x: number; label: string }[] = [];
    for (let i = 0; i < count; i++) {
      const index = Math.round((i / (count - 1)) * (points.length - 1));
      ticks.push({
        x: getX(index),
        label: formatDateLabel(points[index].time, range),
      });
    }
    return ticks;
  }, [points, range]);

  // Active point for HUD (hovered point if mouse over chart, otherwise latest point)
  const activePoint = useMemo(() => {
    if (hoverIndex !== null && points[hoverIndex]) {
      return points[hoverIndex];
    }
    return points[points.length - 1] || null;
  }, [hoverIndex, points]);

  // Compute active performance stats
  const activeStats = useMemo(() => {
    if (!points.length || !activePoint) {
      return {
        price: initialPrice ?? 0,
        change: initialChange ?? 0,
        changePercent: initialChangePercent ?? 0,
        isUp: (initialChange ?? 0) >= 0,
        dateLabel: "Latest Session",
      };
    }

    const firstPoint = points[0];
    const price = activePoint.close;
    const basePrice = firstPoint.close;
    const change = price - basePrice;
    const changePercent = basePrice > 0 ? (change / basePrice) * 100 : 0;
    const isUp = change >= 0;

    return {
      price,
      change,
      changePercent,
      isUp,
      dateLabel: formatDateLabel(activePoint.time, range),
    };
  }, [points, activePoint, range, initialPrice, initialChange, initialChangePercent]);

  // Handle pointer scrub across chart
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!points.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, (clientX - (paddingLeft / svgWidth) * rect.width) / ((chartWidth / svgWidth) * rect.width)));
    const index = Math.round(ratio * (points.length - 1));
    const clamped = Math.max(0, Math.min(points.length - 1, index));
    setHoverIndex(clamped);
  };

  const handlePointerLeave = () => {
    setHoverIndex(null);
  };

  // Color scheme constants
  const strokeColor = isPositivePeriod ? "#10b981" : "#ef4444";
  const gradStartColor = isPositivePeriod ? "rgba(16, 185, 129, 0.28)" : "rgba(239, 68, 68, 0.28)";
  const gradEndColor = isPositivePeriod ? "rgba(16, 185, 129, 0.0)" : "rgba(239, 68, 68, 0.0)";

  return (
    <div className="stock-chart-card" ref={containerRef}>
      {/* 1. Header HUD & Metric Display */}
      <div className="stock-chart-header">
        <div className="stock-chart-header-left">
          <div className="stock-chart-price-display">
            <span className="stock-chart-price-value">
              {formatInr(activeStats.price)}
            </span>
            <span
              className={`stock-chart-badge ${
                activeStats.isUp ? "is-positive" : "is-negative"
              }`}
            >
              {activeStats.isUp ? (
                <TrendingUp size={15} aria-hidden="true" />
              ) : (
                <TrendingDown size={15} aria-hidden="true" />
              )}
              <span>
                {activeStats.change >= 0 ? "+" : ""}
                {activeStats.change.toFixed(2)} ({activeStats.changePercent >= 0 ? "+" : ""}
                {activeStats.changePercent.toFixed(2)}%)
              </span>
              <span className="stock-chart-range-tag">
                {hoverIndex !== null ? "Selected" : range}
              </span>
            </span>
          </div>

          <p className="stock-chart-timestamp">
            <Calendar size={13} aria-hidden="true" />
            <span>
              {activePoint
                ? new Date(activePoint.time * 1000).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    dateStyle: "full",
                    timeStyle: range === "1D" || range === "5D" ? "short" : undefined,
                  })
                : "Latest quote"}
            </span>
            {hoverIndex !== null && (
              <span className="stock-chart-scrub-hint">· Hovered point</span>
            )}
          </p>
        </div>

        <div className="stock-chart-header-right">
          {/* Chart Style Toggle (Area vs Candlesticks) */}
          <div className="stock-chart-type-toggle" role="group" aria-label="Chart display type">
            <button
              type="button"
              className={`stock-chart-toggle-btn ${chartType === "area" ? "is-active" : ""}`}
              onClick={() => setChartType("area")}
              title="Line area chart"
              aria-pressed={chartType === "area"}
            >
              <LineChartIcon size={14} />
              <span>Line</span>
            </button>
            <button
              type="button"
              className={`stock-chart-toggle-btn ${chartType === "candles" ? "is-active" : ""}`}
              onClick={() => setChartType("candles")}
              title="Candlestick chart"
              aria-pressed={chartType === "candles"}
            >
              <CandlestickChart size={14} />
              <span>Candles</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Timeframe Selector Pills */}
      <div className="stock-chart-toolbar">
        <div className="stock-chart-range-tabs" role="tablist" aria-label="Chart timeframes">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={range === r.key}
              className={`stock-chart-range-tab ${range === r.key ? "is-active" : ""}`}
              onClick={() => setRange(r.key)}
              disabled={loading}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="stock-chart-toolbar-meta">
          {data?.meta && (
            <div className="stock-chart-hi-lo">
              <span>
                H: <strong>{formatInr(data.meta.periodHigh)}</strong>
              </span>
              <span>
                L: <strong>{formatInr(data.meta.periodLow)}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Main Chart Canvas Area */}
      <div className="stock-chart-viewport" aria-busy={loading}>
        {loading && (
          <div className="stock-chart-loading-overlay">
            <RefreshCw size={22} className="company-spinning" />
            <span>Updating {range} price & volume chart…</span>
          </div>
        )}

        {error ? (
          <div className="stock-chart-error-state" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="stock-chart-retry-btn"
              onClick={() => setRange((r) => r)}
            >
              Retry
            </button>
          </div>
        ) : points.length === 0 && !loading ? (
          <div className="stock-chart-error-state">
            <p>No trading data available for this timeframe.</p>
          </div>
        ) : (
          <svg
            className="stock-chart-svg"
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            preserveAspectRatio="none"
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
          >
            <defs>
              <linearGradient id={`grad_${chartId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={gradStartColor} />
                <stop offset="95%" stopColor={gradEndColor} />
              </linearGradient>
            </defs>

            {/* Price Grid Lines & Right Price Labels */}
            {priceGridLines.map((line, idx) => (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={line.y}
                  x2={paddingLeft + chartWidth}
                  y2={line.y}
                  className="stock-chart-gridline"
                />
                <text
                  x={paddingLeft + chartWidth + 8}
                  y={line.y + 4}
                  className="stock-chart-axis-label"
                >
                  ₹{line.price >= 1000 ? line.price.toFixed(0) : line.price.toFixed(1)}
                </text>
              </g>
            ))}

            {/* Separator between Price and Volume Panes */}
            <line
              x1={paddingLeft}
              y1={volumeTop - 12}
              x2={paddingLeft + chartWidth}
              y2={volumeTop - 12}
              className="stock-chart-pane-divider"
            />

            {/* Volume Scale Label */}
            <text
              x={paddingLeft + chartWidth + 8}
              y={volumeTop + 14}
              className="stock-chart-axis-label volume-label"
            >
              Vol: {formatVolume(maxVolume)}
            </text>

            {/* Area or Candlesticks Plot */}
            {chartType === "area" ? (
              <>
                {/* Area Gradient Fill */}
                <path d={areaPath} fill={`url(#grad_${chartId})`} />
                {/* Crisp Price Stroke Line */}
                <path
                  d={linePath}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            ) : (
              /* Candlestick Rendering */
              <g className="stock-chart-candles">
                {points.map((p, idx) => {
                  const x = getX(idx);
                  const isUp = p.close >= p.open;
                  const candleColor = isUp ? "#10b981" : "#ef4444";
                  const wickY1 = getY(p.high);
                  const wickY2 = getY(p.low);
                  const bodyY = getY(Math.max(p.open, p.close));
                  const bodyHeight = Math.max(2, Math.abs(getY(p.open) - getY(p.close)));
                  const candleWidth = Math.max(2, Math.min(10, (chartWidth / points.length) * 0.75));

                  return (
                    <g key={idx}>
                      {/* Wick */}
                      <line
                        x1={x}
                        y1={wickY1}
                        x2={x}
                        y2={wickY2}
                        stroke={candleColor}
                        strokeWidth="1.2"
                      />
                      {/* Body */}
                      <rect
                        x={x - candleWidth / 2}
                        y={bodyY}
                        width={candleWidth}
                        height={bodyHeight}
                        fill={isUp ? candleColor : candleColor}
                        rx="1"
                      />
                    </g>
                  );
                })}
              </g>
            )}

            {/* Volume Histogram Bars */}
            <g className="stock-chart-volume-bars">
              {points.map((p, idx) => {
                const x = getX(idx);
                const isUp = p.close >= p.open;
                const barColor = isUp ? "#10b981" : "#ef4444";
                const barY = getVolY(p.volume);
                const barHeight = Math.max(1, volumeBottom - barY);
                const barWidth = Math.max(1.5, Math.min(8, (chartWidth / points.length) * 0.7));

                return (
                  <rect
                    key={idx}
                    x={x - barWidth / 2}
                    y={barY}
                    width={barWidth}
                    height={barHeight}
                    fill={barColor}
                    opacity={hoverIndex === idx ? 0.95 : 0.6}
                    rx="1"
                  />
                );
              })}
            </g>

            {/* High & Low Price Markers on Area Chart */}
            {chartType === "area" && highPoint && (
              <g className="stock-chart-peak-marker">
                <circle
                  cx={getX(highPoint.index)}
                  cy={getY(highPoint.point.high)}
                  r="3.5"
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <text
                  x={getX(highPoint.index)}
                  y={getY(highPoint.point.high) - 8}
                  textAnchor="middle"
                  className="stock-chart-peak-label"
                >
                  ₹{highPoint.point.high.toFixed(0)}
                </text>
              </g>
            )}

            {chartType === "area" && lowPoint && (
              <g className="stock-chart-peak-marker">
                <circle
                  cx={getX(lowPoint.index)}
                  cy={getY(lowPoint.point.low)}
                  r="3.5"
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <text
                  x={getX(lowPoint.index)}
                  y={getY(lowPoint.point.low) + 14}
                  textAnchor="middle"
                  className="stock-chart-peak-label"
                >
                  ₹{lowPoint.point.low.toFixed(0)}
                </text>
              </g>
            )}

            {/* Time Axis Labels along bottom */}
            {timeTicks.map((tick, idx) => (
              <text
                key={idx}
                x={tick.x}
                y={timeAxisY}
                textAnchor={idx === 0 ? "start" : idx === timeTicks.length - 1 ? "end" : "middle"}
                className="stock-chart-time-label"
              >
                {tick.label}
              </text>
            ))}

            {/* Crosshair & Hover Cursor */}
            {hoverIndex !== null && points[hoverIndex] && (
              <g className="stock-chart-crosshair">
                {/* Vertical Crosshair Line */}
                <line
                  x1={getX(hoverIndex)}
                  y1={priceTop}
                  x2={getX(hoverIndex)}
                  y2={volumeBottom}
                  stroke="#8b5cf6"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                {/* Active Price Point Circle */}
                <circle
                  cx={getX(hoverIndex)}
                  cy={getY(points[hoverIndex].close)}
                  r="5"
                  fill="#8b5cf6"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>
        )}
      </div>

      {/* 4. Detailed HUD Card on Scrub */}
      {activePoint && (
        <div className="stock-chart-point-details">
          <div className="stock-chart-point-metric">
            <span className="stock-chart-detail-label">Open</span>
            <span className="stock-chart-detail-val">{formatInr(activePoint.open)}</span>
          </div>
          <div className="stock-chart-point-metric">
            <span className="stock-chart-detail-label">High</span>
            <span className="stock-chart-detail-val is-high">{formatInr(activePoint.high)}</span>
          </div>
          <div className="stock-chart-point-metric">
            <span className="stock-chart-detail-label">Low</span>
            <span className="stock-chart-detail-val is-low">{formatInr(activePoint.low)}</span>
          </div>
          <div className="stock-chart-point-metric">
            <span className="stock-chart-detail-label">Close</span>
            <span className="stock-chart-detail-val">{formatInr(activePoint.close)}</span>
          </div>
          <div className="stock-chart-point-metric">
            <span className="stock-chart-detail-label">
              <Volume2 size={12} aria-hidden="true" />
              Volume
            </span>
            <span className="stock-chart-detail-val">{formatVolume(activePoint.volume)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
