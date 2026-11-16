"use client";

import { useEffect, useRef, useState } from "react";
import { CandlestickChart, Maximize2, RefreshCw } from "lucide-react";

export default function StockTechnicalChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const widgetDiv = document.createElement("div");
    widgetDiv.id = `tradingview_${symbol}_chart`;
    widgetDiv.style.width = "100%";
    widgetDiv.style.height = "100%";
    container.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.type = "text/javascript";
    script.async = true;

    script.onload = () => {
      setIsLoading(false);
      // @ts-expect-error TradingView global injected by tv.js
      if (typeof window !== "undefined" && window.TradingView) {
        try {
          // @ts-expect-error TradingView global injected by tv.js
          new window.TradingView.widget({
            autosize: true,
            symbol: `NSE:${symbol}`,
            interval: "D",
            timezone: "Asia/Kolkata",
            theme: "light",
            style: "1",
            locale: "en",
            toolbar_bg: "#f8f7fb",
            enable_publishing: false,
            allow_symbol_change: true,
            container_id: widgetDiv.id,
            hide_side_toolbar: false,
            studies: ["Volume@tv-basicstudies"],
            disabled_features: ["use_localstorage_for_settings"],
            enabled_features: ["study_templates"],
          });
        } catch {
          setHasError(true);
        }
      }
    };

    script.onerror = () => {
      setIsLoading(false);
      setHasError(true);
    };

    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [symbol]);

  return (
    <div className="company-technical-chart-wrapper">
      <div className="technical-chart-header">
        <div className="technical-chart-title">
          <CandlestickChart size={17} aria-hidden="true" />
          <span>Technical Candlestick & Trend Chart</span>
        </div>
        <div className="technical-chart-meta">
          <span className="technical-chart-badge">NSE · {symbol}</span>
          <a
            href={`https://www.tradingview.com/chart/?symbol=NSE%3A${encodeURIComponent(symbol)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="technical-chart-popout"
            title="Open full interactive chart on TradingView"
          >
            <span>Full screen</span>
            <Maximize2 size={13} />
          </a>
        </div>
      </div>

      <div
        className="technical-chart-canvas-container"
        style={{
          position: "relative",
          minHeight: "440px",
          height: "480px",
          width: "100%",
          background: "#ffffff",
          borderRadius: "10px",
          overflow: "hidden",
          border: "1px solid var(--line, #e7dced)",
        }}
      >
        {isLoading && (
          <div
            className="chart-loading-overlay"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              color: "var(--muted)",
              fontSize: "13px",
              zIndex: 1,
              background: "#ffffff",
            }}
          >
            <RefreshCw size={18} className="company-spinning" />
            <span>Initializing interactive chart…</span>
          </div>
        )}

        {hasError ? (
          <div
            className="chart-error-fallback"
            style={{
              padding: "40px 20px",
              textAlign: "center",
              color: "var(--muted)",
            }}
          >
            <p style={{ fontSize: "13px", marginBottom: "12px" }}>
              TradingView interactive feed is loading or temporarily blocked by browser shield.
            </p>
            <a
              href={`https://www.tradingview.com/chart/?symbol=NSE%3A${encodeURIComponent(symbol)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="watchlist-button-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                padding: "8px 14px",
                textDecoration: "none",
              }}
            >
              Open NSE:{symbol} on TradingView <Maximize2 size={13} />
            </a>
          </div>
        ) : (
          <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        )}
      </div>
    </div>
  );
}
