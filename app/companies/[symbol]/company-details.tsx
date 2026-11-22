"use client";

import Link from "next/link";
import GlobalCompanySearch from "../../global-company-search";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Bookmark, RefreshCw, TrendingUp } from "lucide-react";
import VolumeAnalysis from "./volume-analysis";
import StockPriceVolumeChart from "./stock-price-volume-chart";
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
  const active = useRef<AbortController | null>(null);

  useEffect(() => {
    let activeReq = true;
    getClerkAuthHeaders().then((headers) => {
      fetch("/api/watchlist", { headers, cache: "no-store" })
        .then((res) => (res.ok ? res.json() : { items: [] }))
        .then((data: { items?: Array<{ itemKey: string; itemType: string }> }) => {
          if (!activeReq) return;
          const exists = (data.items || []).some(
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

          {/* 1. Primary Interactive Price & Volume Chart (5 Years, 1Y, 6M, 1M, 5D, 1D) */}
          <StockPriceVolumeChart
            symbol={security.symbol}
            companyName={security.name}
            currentPrice={q?.price ?? eod?.close ?? null}
            currentChange={q?.change ?? null}
            currentChangePercent={q?.changePercent ?? null}
          />

          {/* 2. Price Position & 52-Week Range */}
          {q && (
            <section
              className="company-panel"
              aria-labelledby="company-range-title"
            >
              <h2 id="company-range-title">
                <TrendingUp size={17} />
                Price Position & Ranges
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
          )}

          {/* 3. Delivery Volume Trends & Breakdown */}
          <VolumeAnalysis
            symbol={security.symbol}
            series={q?.series ?? "EQ"}
            refreshToken={volumeRefresh}
          />

          {/* 4. Official NSE Sources and Disclosures */}
          {snapshot && (
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
                Retrieved {time(snapshot.retrievedAt)}.
              </p>
              <p>
                Historical price and volume series sourced from exchange trading records.
                NSE describes live quotes as 1–3 minutes delayed during active sessions.
                Delivery percentage and volume trends are calculated from daily bhavdata disclosures.
              </p>
            </details>
          )}
        </div>
      </main>
    </div>
  );
}
