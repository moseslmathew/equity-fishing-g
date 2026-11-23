"use client";

import Link from "next/link";
import GlobalCompanySearch from "../../global-company-search";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Bookmark,
  MessageSquareQuote,
  RefreshCw,
  TrendingUp,
  X,
} from "lucide-react";
import VolumeAnalysis from "./volume-analysis";
import StockPriceVolumeChart from "./stock-price-volume-chart";
import ConcallModal from "./concall-modal";
import { getClerkAuthHeaders } from "../../clerk-client";
import "./stock-price-volume-chart.css";
import type { NseSnapshot } from "../../../lib/nse-mcp";

const amount = (n: number | null | undefined) =>
  n == null ? "Unavailable" : "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const count = (n: number | null | undefined) =>
  n == null ? "Unavailable" : n.toLocaleString("en-IN");
const percent = (n: number | null | undefined) =>
  n == null ? "Unavailable" : (n > 0 ? "+" : "") + n.toFixed(2) + "%";
const tone = (n: number | null | undefined) =>
  n == null || n === 0 ? "" : n > 0 ? "company-up" : "company-down";
const time = (value: string | null | undefined) => {
  if (!value) return "Timestamp unavailable";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " IST"
    : "Timestamp unavailable";
};

function Metric({
  label,
  value,
  note,
  className = "",
}: {
  label: string;
  value: string;
  note?: string;
  className?: string;
}) {
  return (
    <div className="company-metric">
      <dt>{label}</dt>
      <dd className={className}>{value}</dd>
      {note && <small>{note}</small>}
    </div>
  );
}

function Range({
  label,
  low,
  high,
  price,
}: {
  label: string;
  low: number | null;
  high: number | null;
  price: number | null;
}) {
  const valid = low !== null && high !== null && high >= low;
  const position =
    valid && price !== null && high > low
      ? Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100))
      : null;
  return (
    <div className="company-range">
      <h3>{label}</h3>
      <div className="company-range-labels">
        <span>
          Low<strong>{amount(low)}</strong>
        </span>
        <span>
          High<strong>{amount(high)}</strong>
        </span>
      </div>
      {valid && (
        <div
          className="company-range-track"
          aria-label={
            label +
            ", low " +
            amount(low) +
            ", high " +
            amount(high) +
            (price !== null ? ", last price " + amount(price) : "")
          }
        >
          {position !== null && <span style={{ left: position + "%" }} />}
        </div>
      )}
    </div>
  );
}

export default function CompanyDetails({
  security,
}: {
  security: { symbol: string; name: string; isin: string };
}) {
  const [snapshot, setSnapshot] = useState<NseSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [volumeRefresh, setVolumeRefresh] = useState(0);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistBusy, setWatchlistBusy] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const [showConcallModal, setShowConcallModal] = useState(false);
  const active = useRef<AbortController | null>(null);

  // Synchronize watchlist state with database
  useEffect(() => {
    let activeReq = true;
    getClerkAuthHeaders().then((headers) => {
      fetch("/api/watchlist", { headers, cache: "no-store" })
        .then((res) => (res.ok ? (res.json() as Promise<{ items?: Array<{ itemKey: string; itemType: string }> }>) : { items: [] }))
        .then((data) => {
          if (!activeReq) return;
          const items = data.items || [];
          const exists = items.some(
            (i) => i.itemType === "stock" && i.itemKey.toUpperCase() === security.symbol.toUpperCase()
          );
          setInWatchlist(exists);
        })
        .catch(() => {});
    });
    return () => {
      activeReq = false;
    };
  }, [security.symbol]);

  // Handle escape key and body scroll lock for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showChartModal) setShowChartModal(false);
        if (showConcallModal) setShowConcallModal(false);
      }
    };
    if (showChartModal || showConcallModal) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showChartModal, showConcallModal]);

  const handleToggleWatchlist = async () => {
    if (watchlistBusy) return;
    setWatchlistBusy(true);
    try {
      const authHeaders = await getClerkAuthHeaders();
      if (inWatchlist) {
        const res = await fetch(
          `/api/watchlist?itemType=stock&itemKey=${encodeURIComponent(security.symbol.toUpperCase())}`,
          { method: "DELETE", headers: authHeaders }
        );
        if (res.ok) setInWatchlist(false);
      } else {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({
            itemType: "stock",
            itemKey: security.symbol.toUpperCase(),
            itemTitle: security.name,
            itemSubtitle: "Equity",
          }),
        });
        if (res.ok) setInWatchlist(true);
      }
    } catch (err) {
      console.error("Watchlist toggle failed", err);
    } finally {
      setWatchlistBusy(false);
    }
  };

  useEffect(() => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;

    fetch("/api/nse?symbol=" + encodeURIComponent(security.symbol), {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json()) as NseSnapshot & { error?: string };
        if (controller.signal.aborted) return;
        if (!response.ok && !(data.live || data.eod)) {
          throw new Error(
            data.error ||
              [...new Set([data.liveError, data.eodError].filter(Boolean))].join(" ") ||
              "NSE data is temporarily unavailable. Please try again."
          );
        }
        setSnapshot(data);
        setError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "NSE data could not be loaded.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => active.current?.abort();
  }, [security.symbol, reloadTrigger]);

  const handleRefresh = () => {
    setLoading(true);
    setError("");
    setReloadTrigger((n) => n + 1);
    setVolumeRefresh((n) => n + 1);
  };

  const q = snapshot?.live,
    eod = snapshot?.eod;
  const distance = q?.price && q.yearHigh ? (q.price / q.yearHigh - 1) * 100 : null;
  const fromLow = q?.price && q.yearLow ? (q.price / q.yearLow - 1) * 100 : null;
  const dayRange =
    q?.high && q.low && q.low <= q.high ? (q.high / q.low - 1) * 100 : null;

  return (
    <div className="company-page">
      <header className="site-header">
        <Link className="company-brand" href="/">
          Smallcap <span>OBSERVATORY</span>
        </Link>
        <GlobalCompanySearch />
        <Link className="company-back" href="/#watchlist">
          <ArrowLeft size={15} />
          Watchlist
        </Link>
      </header>

      <main className="company-main">
        <Link className="company-back company-back-top" href="/#watchlist">
          <ArrowLeft size={15} />
          Back to watchlist
        </Link>

        <div className="company-title-row">
          <div>
            <p className="company-eyebrow">
              NSE · {security.symbol}
              {q ? " · " + q.series : ""}
            </p>
            <h1>{security.name}</h1>
            <p className="company-isin">ISIN {security.isin}</p>
          </div>

          <div className="company-actions">
            <button
              type="button"
              onClick={() => setShowChartModal(true)}
              className="company-chart-btn"
              title="Open interactive price & volume chart"
            >
              <BarChart3 size={15} />
              <span>Charts</span>
            </button>
            <button
              type="button"
              onClick={() => setShowConcallModal(true)}
              className="company-concall-btn"
              title="Last concall details & forensic analysis"
            >
              <MessageSquareQuote size={15} />
              <span>Concall</span>
            </button>
            <button
              type="button"
              onClick={handleToggleWatchlist}
              disabled={watchlistBusy}
              className={`company-watchlist-btn ${inWatchlist ? "is-in-watchlist" : ""}`}
              title={inWatchlist ? "Remove from watchlist" : "Save to watchlist"}
            >
              <Bookmark size={15} fill={inWatchlist ? "currentColor" : "none"} />
              <span>{inWatchlist ? "In Watchlist" : "Watchlist"}</span>
            </button>
            <button disabled={loading} onClick={handleRefresh} title="Refresh live quotes">
              <RefreshCw size={15} className={loading ? "company-spinning" : ""} />
              {loading ? "Loading" : "Refresh"}
            </button>
            <a
              href={
                "https://www.nseindia.com/get-quotes/equity?symbol=" +
                encodeURIComponent(security.symbol)
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              View on NSE
              <ArrowUpRight size={15} />
              <span className="sr-only"> (new tab)</span>
            </a>
          </div>
        </div>

        {error && (
          <div className="company-notice" role="alert">
            {error}
            <button onClick={handleRefresh}>Try again</button>
          </div>
        )}

        <div
          aria-busy={loading}
          className={loading ? "company-content is-loading" : "company-content"}
        >
          {loading && !snapshot && (
            <div className="company-loading" role="status">
              <RefreshCw size={20} className="company-spinning" />
              Fetching market data from NSE…
            </div>
          )}

          {snapshot && (
            <>
              {q ? (
                <>
                  {/* 1. Last Traded Price Panel */}
                  <section
                    className="company-quote-panel"
                    aria-labelledby="company-quote-title"
                  >
                    <div>
                      <h2 id="company-quote-title" className="sr-only">
                        Live quote
                      </h2>
                      <p className="company-eyebrow">Last traded price</p>
                      <div className="company-price">
                        <strong>{amount(q.price)}</strong>
                        <span className={tone(q.change)}>
                          {percent(q.changePercent)}
                          <small>
                            {q.change !== null
                              ? (q.change > 0 ? "+" : "") +
                                amount(q.change) +
                                " vs previous close"
                              : ""}
                          </small>
                        </span>
                      </div>
                      <p className="company-time">
                        {time(q.asOfIso || q.asOf)} · Delayed quote
                      </p>
                    </div>
                    <dl className="company-quick-metrics">
                      <Metric
                        label="30-day price change"
                        value={percent(q.change30d)}
                        className={tone(q.change30d)}
                      />
                      <Metric
                        label="Session volume"
                        value={count(q.volume)}
                        note="Shares traded"
                      />
                    </dl>
                  </section>

                  {/* 2. Delivery Volume Percentage */}
                  <VolumeAnalysis
                    symbol={security.symbol}
                    series={q?.series ?? "EQ"}
                    refreshToken={volumeRefresh}
                  />

                  {/* 3. Price Position & 52-Week Range */}
                  <section
                    className="company-panel"
                    aria-labelledby="company-range-title"
                  >
                    <h2 id="company-range-title">
                      <TrendingUp size={17} />
                      Price position
                    </h2>
                    <div className="company-ranges">
                      <Range
                        label="52-week range"
                        low={q.yearLow}
                        high={q.yearHigh}
                        price={q.price}
                      />
                      <Range
                        label="Session range"
                        low={q.low}
                        high={q.high}
                        price={q.price}
                      />
                    </div>
                    <dl className="company-position-metrics">
                      <Metric
                        label="From 52-week high"
                        value={percent(distance)}
                        note="Last price ÷ high − 1"
                        className={tone(distance)}
                      />
                      <Metric
                        label="Above 52-week low"
                        value={percent(fromLow)}
                        note="Last price ÷ low − 1"
                        className={tone(fromLow)}
                      />
                      <Metric
                        label="Session high–low spread"
                        value={
                          dayRange === null
                            ? "Unavailable"
                            : dayRange.toFixed(2) + "%"
                        }
                        note="High ÷ low − 1"
                      />
                    </dl>
                  </section>

                  {/* 4. Trading Session */}
                  <section
                    className="company-panel"
                    aria-labelledby="company-session-title"
                  >
                    <h2 id="company-session-title">Trading session</h2>
                    <dl className="company-session-metrics">
                      <Metric label="Open" value={amount(q.open)} />
                      <Metric
                        label="Previous close"
                        value={amount(q.previousClose)}
                      />
                      <Metric label="High" value={amount(q.high)} />
                      <Metric label="Low" value={amount(q.low)} />
                    </dl>
                  </section>
                </>
              ) : (
                <div className="company-notice" role="status">
                  Latest quote unavailable. {snapshot.liveError}
                </div>
              )}

              {/* 5. Latest Closing Data */}
              {eod ? (
                <section
                  className="company-panel company-eod"
                  aria-labelledby="company-eod-title"
                >
                  <div>
                    <h2 id="company-eod-title">Latest closing data</h2>
                    <p>{eod.date || "Date unavailable"} · NSE Bhavcopy</p>
                  </div>
                  <dl className="company-eod-metrics">
                    <Metric
                      label="Closing price"
                      value={amount(eod.close)}
                    />
                    <Metric
                      label="Full-session volume"
                      value={count(eod.volume)}
                      note="Shares traded"
                    />
                  </dl>
                </section>
              ) : (
                <p className="company-time">
                  Closing data unavailable. {snapshot.eodError}
                </p>
              )}

              {/* 6. Sources and Data Notes */}
              <details className="company-sources">
                <summary>Sources and data notes</summary>
                <p>
                  <a
                    href="https://www.nseindia.com/nse-mcp"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Official NSE MCP
                  </a>{" "}
                  · CM Market for quotes; Bhavcopy for closing data.
                  Retrieved {time(snapshot.retrievedAt)}. Quote time above is
                  NSE’s source timestamp, not the retrieval time.
                </p>
                <p>
                  NSE describes quotes as 1–3 minutes delayed during active sessions.
                  Delivery percentage and volume trends are calculated from daily bhavdata disclosures.
                </p>
              </details>
            </>
          )}
        </div>
      </main>

      {/* Chart Popup Modal Dialog */}
      {showChartModal && (
        <div
          className="company-chart-modal-backdrop"
          onClick={() => setShowChartModal(false)}
          role="presentation"
        >
          <div
            className="company-chart-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="company-chart-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="company-chart-modal-header">
              <div className="company-chart-modal-heading">
                <h2 id="company-chart-modal-title">{security.name}</h2>
                <p className="company-chart-modal-subtitle">
                  NSE · {security.symbol} · Price and volume
                </p>
              </div>
              <button
                type="button"
                className="company-chart-modal-close"
                onClick={() => setShowChartModal(false)}
                aria-label="Close chart dialog"
                title="Close (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            <div className="company-chart-modal-body">
              <StockPriceVolumeChart
                symbol={security.symbol}
                companyName={security.name}
                currentPrice={q?.price ?? eod?.close ?? null}
                currentChange={q?.change ?? null}
                currentChangePercent={q?.changePercent ?? null}
                eodDate={eod?.date ?? null}
                eodVolume={eod?.volume ?? q?.volume ?? null}
              />
            </div>
          </div>
        </div>
      )}

      {showConcallModal && (
        <ConcallModal
          symbol={security.symbol}
          companyName={security.name}
          onClose={() => setShowConcallModal(false)}
        />
      )}
    </div>
  );
}
