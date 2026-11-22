"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Bookmark,
  Building2,
  Download,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useClerkAuth } from "./clerk-client";
import { fundCatalog } from "../lib/fund-catalog";
import type { BatchQuoteEntry } from "../lib/nse-mcp";
import "./watchlist.css";

type WatchlistItem = {
  id: string;
  userId: string;
  itemType: "stock" | "fund";
  itemKey: string;
  itemTitle: string;
  itemSubtitle?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type SortKey = "title" | "price" | "change" | "createdAt";
type SortDir = 1 | -1;

const BOILERPLATE_SUBTITLES = new Set([
  "equity · nse main board",
  "equity",
  "indian mutual fund scheme",
]);

function displaySubtitle(item: WatchlistItem): string | null {
  const sub = item.itemSubtitle?.trim();
  if (!sub || BOILERPLATE_SUBTITLES.has(sub.toLowerCase())) return null;
  return sub;
}

function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCompactDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatQuoteTimestamp(asOf?: string | null, asOfIso?: string | null): string | null {
  const iso = asOfIso || (asOf ? asOf.replace(" ", "T") + "+05:30" : null);
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export default function WatchlistView() {
  const { isLoaded, isSignedIn, user, openSignIn } = useClerkAuth();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "stock" | "fund">("all");
  const [tableFilter, setTableFilter] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "title", dir: 1 });

  // Live LTP state refreshed automatically on page load & manual Sync
  const [quotes, setQuotes] = useState<Record<string, BatchQuoteEntry | null>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesUpdatedAt, setQuotesUpdatedAt] = useState<string | null>(null);

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [itemType, setItemType] = useState<"stock" | "fund">("stock");
  const [itemKey, setItemKey] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemSubtitle, setItemSubtitle] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // NSE autocomplete & modal preview quote
  const [searchQuery, setSearchQuery] = useState("");
  const [candidates, setCandidates] = useState<
    Array<{
      symbol: string;
      name: string;
      isin: string;
      sector: string;
      price: number | null;
      changePercent: number | null;
      close: number | null;
      date: string | null;
    }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isManualEdit, setIsManualEdit] = useState(false);
  const [directAddingKey, setDirectAddingKey] = useState<string | null>(null);

  const fetchLiveQuotes = useCallback(async (list: WatchlistItem[]) => {
    const stockSymbols = [...new Set(list.filter((i) => i.itemType === "stock").map((i) => i.itemKey.trim().toUpperCase()).filter(Boolean))];
    if (!stockSymbols.length) {
      setQuotes({});
      setQuotesLoading(false);
      return;
    }
    setQuotesLoading(true);
    try {
      const merged: Record<string, BatchQuoteEntry | null> = {};
      let latestTime: string | null = null;
      for (let i = 0; i < stockSymbols.length; i += 30) {
        const chunk = stockSymbols.slice(i, i + 30);
        const res = await fetch(`/api/nse?symbols=${encodeURIComponent(chunk.join(","))}`, { cache: "no-store" });
        if (!res.ok) continue;
        const payload = (await res.json()) as {
          quotes?: Record<string, BatchQuoteEntry | null>;
          retrievedAt?: string;
        };
        if (payload.quotes) Object.assign(merged, payload.quotes);
        if (payload.retrievedAt) latestTime = payload.retrievedAt;
      }
      setQuotes((prev) => ({ ...prev, ...merged }));
      setQuotesUpdatedAt(latestTime ?? new Date().toISOString());
    } catch {
      // Retain any prior quotes cleanly if live network request fails
    } finally {
      setQuotesLoading(false);
    }
  }, []);

  const loadWatchlist = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/watchlist", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) {
          setItems([]);
          return;
        }
        throw new Error("Failed to load watchlist");
      }
      const data = (await res.json()) as { items?: WatchlistItem[] };
      const list = data.items || [];
      setItems(list);
      void fetchLiveQuotes(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load watchlist");
    } finally {
      setLoading(false);
    }
  }, [fetchLiveQuotes]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) void loadWatchlist();
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, loadWatchlist]);

  // Debounced NSE search in Add modal
  useEffect(() => {
    const q = searchQuery.trim();
    if (itemType !== "stock" || q.length < 1) {
      return;
    }

    let active = true;
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/nse?query=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error("Search failed");
        const data = (await res.json()) as { candidates?: typeof candidates };
        if (active) {
          setCandidates(data.candidates || []);
          setShowDropdown(true);
        }
      } catch {
        if (active) setCandidates([]);
      } finally {
        if (active) setIsSearching(false);
      }
    }, 180);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [searchQuery, itemType]);

  const handleCloseModal = () => {
    setShowAddModal(false);
    setItemKey("");
    setItemTitle("");
    setItemSubtitle("");
    setNotes("");
    setSearchQuery("");
    setCandidates([]);
    setShowDropdown(false);
    setIsManualEdit(false);
    setDirectAddingKey(null);
    setSubmitError("");
  };

  const handleDirectAddStock = async (c: (typeof candidates)[number]) => {
    if (directAddingKey) return;
    setDirectAddingKey(c.symbol);
    setSubmitError("");
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType: "stock",
          itemKey: c.symbol.trim().toUpperCase(),
          itemTitle: c.name.trim(),
          itemSubtitle: c.sector?.trim() || "Equity",
        }),
      });

      if (!res.ok) {
        const errorData = (await res.json()) as { error?: string };
        throw new Error(errorData.error || "Failed to add security to watchlist");
      }

      if (c.price !== null && c.price !== undefined) {
        setQuotes((prev) => ({
          ...prev,
          [c.symbol.trim().toUpperCase()]: {
            price: c.price,
            previousClose: c.close ?? null,
            change: null,
            changePercent: c.changePercent,
            asOf: c.date ?? new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
            asOfIso: new Date().toISOString(),
            source: "live",
          },
        }));
      }

      handleCloseModal();
      setLoading(true);
      await loadWatchlist();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error adding to watchlist");
    } finally {
      setDirectAddingKey(null);
    }
  };

  const handleDirectAddFund = async (fund: { id: string; name: string }) => {
    if (directAddingKey) return;
    setDirectAddingKey(fund.id);
    setSubmitError("");
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType: "fund",
          itemKey: fund.id,
          itemTitle: fund.name,
          itemSubtitle: "Mutual Fund",
        }),
      });

      if (!res.ok) {
        const errorData = (await res.json()) as { error?: string };
        throw new Error(errorData.error || "Failed to add fund to watchlist");
      }

      handleCloseModal();
      setLoading(true);
      await loadWatchlist();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error adding to watchlist");
    } finally {
      setDirectAddingKey(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemKey.trim() || !itemTitle.trim()) return;

    setSubmitting(true);
    setSubmitError("");
    try {
      const normalizedKey = itemType === "stock" ? itemKey.trim().toUpperCase() : itemKey.trim();
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType,
          itemKey: normalizedKey,
          itemTitle: itemTitle.trim(),
          itemSubtitle: itemSubtitle.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = (await res.json()) as { error?: string };
        throw new Error(errorData.error || "Failed to add item");
      }

      handleCloseModal();
      setLoading(true);
      await loadWatchlist();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error adding to watchlist");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (type: "stock" | "fund", key: string) => {
    if (!confirm(`Remove ${key} from your personal watchlist?`)) return;

    try {
      const res = await fetch(`/api/watchlist?itemType=${type}&itemKey=${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => !(i.itemType === type && i.itemKey === key)));
      }
    } catch (err) {
      console.error("Failed to remove item", err);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    void loadWatchlist();
  };

  const toggleSort = (key: SortKey) => {
    setSort((prev) => ({
      key,
      dir: prev.key === key ? (prev.dir === 1 ? -1 : 1) : key === "title" ? 1 : -1,
    }));
  };

  const visibleItems = useMemo(() => {
    const q = tableFilter.trim().toLowerCase();
    const list = items.filter((item) => {
      if (activeTab !== "all" && item.itemType !== activeTab) return false;
      if (!q) return true;
      return (
        item.itemKey.toLowerCase().includes(q) ||
        item.itemTitle.toLowerCase().includes(q) ||
        (item.itemSubtitle?.toLowerCase().includes(q) ?? false) ||
        (item.notes?.toLowerCase().includes(q) ?? false)
      );
    });

    return [...list].sort((a, b) => {
      if (sort.key === "title") {
        return sort.dir * a.itemTitle.localeCompare(b.itemTitle);
      }
      if (sort.key === "price") {
        const pa = a.itemType === "stock" ? quotes[a.itemKey.toUpperCase()]?.price ?? -Infinity : -Infinity;
        const pb = b.itemType === "stock" ? quotes[b.itemKey.toUpperCase()]?.price ?? -Infinity : -Infinity;
        return sort.dir * (pa - pb);
      }
      if (sort.key === "change") {
        const ca = a.itemType === "stock" ? quotes[a.itemKey.toUpperCase()]?.changePercent ?? -Infinity : -Infinity;
        const cb = b.itemType === "stock" ? quotes[b.itemKey.toUpperCase()]?.changePercent ?? -Infinity : -Infinity;
        return sort.dir * (ca - cb);
      }
      return sort.dir * (Date.parse(a.createdAt) - Date.parse(b.createdAt));
    });
  }, [items, activeTab, tableFilter, sort, quotes]);

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [
      ["Ticker / ID", "Security", "Type", "Sector", "Last Traded Price (INR)", "Day Change (%)", "Added", "Notes"].map(esc).join(","),
      ...visibleItems.map((item) => {
        const q = item.itemType === "stock" ? quotes[item.itemKey.toUpperCase()] : null;
        return [
          item.itemKey,
          item.itemTitle,
          item.itemType,
          displaySubtitle(item) ?? "",
          q?.price != null ? q.price.toFixed(2) : "",
          q?.changePercent != null ? q.changePercent.toFixed(2) : "",
          formatCompactDate(item.createdAt),
          item.notes ?? "",
        ]
          .map(esc)
          .join(",");
      }),
    ].join("\n");

    const blob = new Blob([rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `watchlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stockCount = items.filter((i) => i.itemType === "stock").length;
  const fundCount = items.filter((i) => i.itemType === "fund").length;
  const mixedTypes = activeTab === "all" && stockCount > 0 && fundCount > 0;
  const refreshedTimeLabel = quotesUpdatedAt
    ? new Date(quotesUpdatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) + " IST"
    : null;

  const sortIndicator = (key: SortKey) =>
    sort.key !== key ? (
      <ArrowUpDown size={13} aria-hidden="true" />
    ) : sort.dir === 1 ? (
      <ArrowUp size={13} aria-hidden="true" />
    ) : (
      <ArrowDown size={13} aria-hidden="true" />
    );

  return (
    <div className="watchlist-page">
      {/* Header Bar */}
      <div className="watchlist-header">
        <div className="watchlist-header-copy">
          <h1>
            <span className="watchlist-badge-icon">
              <Bookmark size={19} />
            </span>
            Personal Watchlist
          </h1>
          <p>
            {user?.fullName || user?.primaryEmailAddress?.emailAddress || "Live Portfolio Watchlist"}
            {refreshedTimeLabel && stockCount > 0 ? ` · Live prices refreshed ${refreshedTimeLabel}` : ""}
          </p>
        </div>

        <div className="watchlist-actions">
          <button
            className="watchlist-button-secondary"
            onClick={handleRefresh}
            disabled={loading || quotesLoading}
            title="Refresh watchlist and live prices"
          >
            <RefreshCw size={15} className={loading || quotesLoading ? "refresh-spinning" : undefined} />
            <span>{quotesLoading ? "Updating…" : "Refresh"}</span>
          </button>
          {visibleItems.length > 0 && (
            <button
              className="watchlist-button-secondary"
              onClick={exportCsv}
              title="Export visible rows to CSV"
            >
              <Download size={15} />
              <span>CSV</span>
            </button>
          )}
          <button className="watchlist-button-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            <span>Add to Watchlist</span>
          </button>
        </div>
      </div>

      {/* Controls Toolbar */}
      <div className="watchlist-toolbar">
        <div className="watchlist-tabs" role="tablist" aria-label="Filter watchlist by asset type">
          {(
            [
              { id: "all", label: `All (${items.length})` },
              { id: "stock", label: `Stocks (${stockCount})` },
              { id: "fund", label: `Funds (${fundCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`watchlist-tab-button ${activeTab === tab.id ? "is-active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {items.length > 0 && (
          <div className="watchlist-table-filter">
            <Search size={14} className="watchlist-filter-icon" aria-hidden="true" />
            <input
              type="search"
              placeholder="Filter ticker or company…"
              aria-label="Filter watchlist"
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
            />
          </div>
        )}
      </div>

      {error && (
        <p className="error-notice" role="alert" style={{ marginBottom: "14px" }}>
          {error}
        </p>
      )}

      {/* Loading, Empty State, or Clean Financial Table */}
      {loading ? (
        <div className="watchlist-table-shell" aria-busy="true" aria-label="Loading watchlist">
          <div className="watchlist-skeleton-list">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="watchlist-skeleton-row">
                <span className="watchlist-skeleton-block wide" />
                <span className="watchlist-skeleton-block" />
                <span className="watchlist-skeleton-block" />
              </div>
            ))}
          </div>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="watchlist-empty">
          <div className="watchlist-empty-icon">
            <Bookmark size={26} />
          </div>
          <h3>{tableFilter.trim() ? "No matching watchlist items" : "Your watchlist is empty"}</h3>
          <p>
            {tableFilter.trim()
              ? `No saved holdings matched "${tableFilter.trim()}". Clear the search filter to see all items.`
              : "Add NSE equities or mutual fund schemes to track live prices and notes in one table."}
          </p>
          {tableFilter.trim() ? (
            <button className="watchlist-button-secondary" onClick={() => setTableFilter("")}>
              Clear filter
            </button>
          ) : (
            <button className="watchlist-button-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={15} />
              <span>Add your first item</span>
            </button>
          )}
        </div>
      ) : (
        <div className="watchlist-table-shell">
          <table className="watchlist-table">
            <thead>
              <tr>
                <th
                  scope="col"
                  aria-sort={sort.key === "title" ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                >
                  <button type="button" className="watchlist-sort-btn" onClick={() => toggleSort("title")}>
                    <span>Security</span>
                    {sortIndicator("title")}
                  </button>
                </th>
                <th
                  scope="col"
                  className="is-numeric"
                  aria-sort={sort.key === "price" ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                >
                  <button type="button" className="watchlist-sort-btn is-right" onClick={() => toggleSort("price")}>
                    <span>Last Traded Price</span>
                    {sortIndicator("price")}
                  </button>
                </th>
                <th
                  scope="col"
                  className="is-numeric"
                  aria-sort={sort.key === "change" ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                >
                  <button type="button" className="watchlist-sort-btn is-right" onClick={() => toggleSort("change")}>
                    <span>Day Change</span>
                    {sortIndicator("change")}
                  </button>
                </th>
                <th scope="col" className="is-actions">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => {
                const isStock = item.itemType === "stock";
                const quote = isStock ? quotes[item.itemKey.toUpperCase()] : null;
                const sub = displaySubtitle(item);
                const quoteTime = quote ? formatQuoteTimestamp(quote.asOf, quote.asOfIso) : null;
                const href = isStock
                  ? `/companies/${encodeURIComponent(item.itemKey)}`
                  : `/#${encodeURIComponent(item.itemKey)}`;
                const pct = quote?.changePercent;
                const hasQuoteLoaded = !isStock || item.itemKey.toUpperCase() in quotes;

                return (
                  <tr key={item.id}>
                    <td className="watchlist-cell-security" data-label="Security">
                      <div className="watchlist-security-row">
                        <a href={href} className="watchlist-security-link">
                          <span className="watchlist-security-name">{item.itemTitle}</span>
                        </a>
                        {mixedTypes && !isStock && (
                          <span className="watchlist-kind-badge">Fund</span>
                        )}
                      </div>
                      {(sub || item.notes) && (
                        <div className="watchlist-security-meta">
                          {sub && <span className="watchlist-security-sector">{sub}</span>}
                          {item.notes && <span className="watchlist-security-note">{item.notes}</span>}
                        </div>
                      )}
                    </td>

                    <td className="is-numeric watchlist-cell-price" data-label="LTP">
                      {!isStock ? (
                        <span className="watchlist-muted-dash">—</span>
                      ) : quotesLoading && !hasQuoteLoaded ? (
                        <span className="watchlist-price-skeleton" aria-label="Fetching price" />
                      ) : quote?.price != null ? (
                        <div className="watchlist-price-stack">
                          <span className="watchlist-ltp">{formatInr(quote.price)}</span>
                          {quoteTime && (
                            <span className="watchlist-ltp-time">
                              {quoteTime}
                              {quote.source === "cached" ? " · EOD" : ""}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="watchlist-muted-dash" title="Live price unavailable">
                          Unavailable
                        </span>
                      )}
                    </td>

                    <td className="is-numeric watchlist-cell-change" data-label="Day Change">
                      {!isStock ? (
                        <span className="watchlist-muted-dash">—</span>
                      ) : quotesLoading && !hasQuoteLoaded ? (
                        <span className="watchlist-change-skeleton" aria-label="Fetching change" />
                      ) : pct != null ? (
                        <div className="watchlist-change-stack">
                          <span
                            className={`watchlist-change-pill ${
                              pct > 0 ? "positive" : pct < 0 ? "negative" : "neutral"
                            }`}
                          >
                            {pct > 0 ? (
                              <TrendingUp size={12} aria-hidden="true" />
                            ) : pct < 0 ? (
                              <TrendingDown size={12} aria-hidden="true" />
                            ) : null}
                            <span>
                              {pct > 0 ? "+" : ""}
                              {pct.toFixed(2)}%
                            </span>
                          </span>
                          {quote?.change != null && (
                            <span className="watchlist-change-abs">
                              {quote.change > 0 ? "+" : quote.change < 0 ? "-" : ""}
                              {formatInr(Math.abs(quote.change))}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="watchlist-muted-dash">—</span>
                      )}
                    </td>

                    <td className="is-actions watchlist-cell-actions">
                      {isStock && (
                        <a
                          href={`/companies/${encodeURIComponent(item.itemKey)}?view=charts`}
                          className="watchlist-row-action watchlist-chart-action"
                          aria-label={`Open charts for ${item.itemTitle}`}
                          title="Open stock charts"
                        >
                          <BarChart3 size={15} />
                        </a>
                      )}
                      <a
                        href={href}
                        className="watchlist-row-action"
                        aria-label={`Open details for ${item.itemTitle}`}
                        title={isStock ? "Open stock analysis" : "View mutual fund"}
                      >
                        <ExternalLink size={15} />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleRemove(item.itemType, item.itemKey)}
                        className="watchlist-remove-btn"
                        aria-label={`Remove ${item.itemTitle}`}
                        title="Remove from watchlist"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Solid, Opaque Add Modal */}
      {showAddModal && (
        <div
          className="watchlist-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          <div className="watchlist-modal-card" role="dialog" aria-modal="true" aria-labelledby="watchlist-modal-title">
            <div className="watchlist-modal-header">
              <h2 id="watchlist-modal-title">Add to Watchlist</h2>
              <button className="watchlist-modal-close" onClick={handleCloseModal} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAdd}>
              <div className="watchlist-form-group">
                <label className="watchlist-form-label">Asset Type</label>
                <div className="watchlist-type-selector">
                  <button
                    type="button"
                    onClick={() => {
                      setItemType("stock");
                      setItemKey("");
                      setItemTitle("");
                      setItemSubtitle("");
                      setSearchQuery("");
                      setCandidates([]);
                      setShowDropdown(false);
                      setIsManualEdit(false);
                    }}
                    className={`watchlist-type-option ${itemType === "stock" ? "is-selected" : ""}`}
                  >
                    <TrendingUp size={14} />
                    <span>Stock / Equity</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setItemType("fund");
                      setItemKey("");
                      setItemTitle("");
                      setItemSubtitle("");
                      setSearchQuery("");
                      setCandidates([]);
                      setShowDropdown(false);
                      setIsManualEdit(false);
                    }}
                    className={`watchlist-type-option ${itemType === "fund" ? "is-selected" : ""}`}
                  >
                    <Building2 size={14} />
                    <span>Mutual Fund</span>
                  </button>
                </div>
              </div>

              {itemType === "stock" && !isManualEdit && (
                <div className="watchlist-form-group">
                  <label className="watchlist-form-label">Search Security by Company Name or Ticker</label>
                  <div className="watchlist-search-wrapper">
                    <div className="watchlist-search-input-box">
                      <Search size={16} className="watchlist-search-icon" />
                      <input
                        type="text"
                        className="watchlist-input"
                        placeholder="Type company name or ticker, e.g. Zetwerk, Sansera, CDSL..."
                        value={searchQuery}
                        onChange={(e) => {
                          const next = e.target.value;
                          setSearchQuery(next);
                          if (next.trim().length < 1) {
                            setCandidates([]);
                            setShowDropdown(false);
                            setIsSearching(false);
                          } else {
                            setShowDropdown(true);
                          }
                        }}
                        onFocus={() => {
                          if (candidates.length > 0 || searchQuery.trim().length >= 1) setShowDropdown(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setShowDropdown(false);
                          else if (e.key === "Enter" && candidates.length > 0 && !directAddingKey) {
                            e.preventDefault();
                            void handleDirectAddStock(candidates[0]);
                          }
                        }}
                        autoFocus
                      />
                      {isSearching ? (
                        <span className="watchlist-search-spinner" />
                      ) : searchQuery ? (
                        <button
                          type="button"
                          className="watchlist-search-clear"
                          onClick={() => {
                            setSearchQuery("");
                            setCandidates([]);
                            setShowDropdown(false);
                            setIsSearching(false);
                          }}
                          aria-label="Clear search"
                        >
                          <X size={14} />
                        </button>
                      ) : null}
                    </div>

                    {showDropdown && (
                      <ul className="watchlist-suggestions-menu" role="listbox">
                        {candidates.length > 0 ? (
                          candidates.map((c) => {
                            const isAddingThis = directAddingKey === c.symbol;
                            return (
                              <li
                                key={c.symbol}
                                className={`watchlist-suggestion-item ${isAddingThis ? "is-adding" : ""}`}
                                onClick={() => {
                                  if (!directAddingKey) void handleDirectAddStock(c);
                                }}
                                role="option"
                                aria-selected={false}
                                aria-disabled={Boolean(directAddingKey)}
                              >
                                <div className="watchlist-suggestion-left">
                                  <div className="watchlist-suggestion-headline">
                                    <span className="watchlist-suggestion-symbol">{c.symbol}</span>
                                    <span className="watchlist-suggestion-name">{c.name}</span>
                                  </div>
                                  <div className="watchlist-suggestion-meta">
                                    <span>{c.sector}</span>
                                    {c.isin && <span>· ISIN: {c.isin}</span>}
                                  </div>
                                </div>
                                <div className="watchlist-suggestion-right">
                                  {isAddingThis ? (
                                    <span className="watchlist-adding-indicator">Adding…</span>
                                  ) : (
                                    <>
                                      {c.price !== null && c.price !== undefined && (
                                        <span className="watchlist-suggestion-price">
                                          ₹{c.price.toLocaleString("en-IN")}
                                        </span>
                                      )}
                                      {c.changePercent !== null && c.changePercent !== undefined && (
                                        <span
                                          className={`watchlist-suggestion-change ${
                                            c.changePercent >= 0 ? "positive" : "negative"
                                          }`}
                                        >
                                          {c.changePercent >= 0 ? "+" : ""}
                                          {c.changePercent.toFixed(2)}%
                                        </span>
                                      )}
                                      <span className="watchlist-add-pill">+ Add</span>
                                    </>
                                  )}
                                </div>
                              </li>
                            );
                          })
                        ) : !isSearching && searchQuery.trim().length >= 1 ? (
                          <li className="watchlist-suggestions-empty">
                            <span>No matching NSE equity found for &quot;{searchQuery}&quot;.</span>
                            <button
                              type="button"
                              className="watchlist-manual-toggle"
                              onClick={() => {
                                const trimmed = searchQuery.trim();
                                setItemKey(trimmed.toUpperCase().replace(/\s+/g, ""));
                                setItemTitle(trimmed);
                                setShowDropdown(false);
                                setIsManualEdit(true);
                              }}
                            >
                              Enter details manually
                            </button>
                          </li>
                        ) : null}
                      </ul>
                    )}
                  </div>
                  <div style={{ marginTop: "12px" }}>
                    <button
                      type="button"
                      className="watchlist-manual-toggle"
                      onClick={() => setIsManualEdit(true)}
                    >
                      Or enter ticker details manually
                    </button>
                  </div>
                </div>
              )}

              {itemType === "fund" && !isManualEdit && (
                <div className="watchlist-form-group">
                  <label className="watchlist-form-label">Select Tracked Scheme to Add</label>
                  <select
                    className="watchlist-input"
                    value=""
                    disabled={Boolean(directAddingKey)}
                    onChange={(e) => {
                      const fundId = e.target.value;
                      if (fundId) {
                        const found = fundCatalog.find((f) => f.id === fundId);
                        if (found) {
                          void handleDirectAddFund(found);
                        }
                      }
                    }}
                  >
                    <option value="" disabled>
                      {directAddingKey ? "Adding fund to watchlist…" : "Click to select a fund to add directly…"}
                    </option>
                    {fundCatalog.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <div style={{ marginTop: "12px" }}>
                    <button
                      type="button"
                      className="watchlist-manual-toggle"
                      onClick={() => {
                        setItemKey("");
                        setItemTitle("");
                        setItemSubtitle("Mutual Fund");
                        setIsManualEdit(true);
                      }}
                    >
                      Or enter custom fund manually
                    </button>
                  </div>
                </div>
              )}

              {isManualEdit && (
                <>
                  <div className="watchlist-form-group">
                    <label className="watchlist-form-label">
                      {itemType === "stock" ? "NSE Ticker / Symbol" : "Fund Identifier"}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={itemType === "stock" ? "e.g. ZETWERK, ATHERENERG" : "e.g. nippon, quant-small-cap"}
                      value={itemKey}
                      onChange={(e) => setItemKey(itemType === "stock" ? e.target.value.toUpperCase() : e.target.value)}
                      className="watchlist-input"
                    />
                  </div>

                  <div className="watchlist-form-group">
                    <label className="watchlist-form-label">Name / Display Title</label>
                    <input
                      type="text"
                      required
                      placeholder={
                        itemType === "stock"
                          ? "e.g. Zetwerk Manufacturing Businesses Limited"
                          : "e.g. Nippon India Small Cap Fund"
                      }
                      value={itemTitle}
                      onChange={(e) => setItemTitle(e.target.value)}
                      className="watchlist-input"
                    />
                  </div>

                  <div className="watchlist-form-group">
                    <label className="watchlist-form-label">Sector / Category (Optional)</label>
                    <input
                      type="text"
                      placeholder={itemType === "stock" ? "e.g. Electric Vehicles" : "e.g. Small Cap Fund"}
                      value={itemSubtitle}
                      onChange={(e) => setItemSubtitle(e.target.value)}
                      className="watchlist-input"
                    />
                  </div>

                  <div className="watchlist-form-group">
                    <label className="watchlist-form-label">Notes / Thesis (Optional)</label>
                    <textarea
                      placeholder="Target price, allocation strategy, or why you are monitoring this..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="watchlist-textarea"
                    />
                  </div>
                </>
              )}

              {submitError && (
                <p className="error-notice" role="alert" style={{ marginBottom: "12px" }}>
                  {submitError}
                </p>
              )}

              <div className="watchlist-modal-footer">
                {isManualEdit ? (
                  <>
                    <button
                      type="button"
                      className="watchlist-button-secondary"
                      onClick={() => setIsManualEdit(false)}
                      disabled={submitting}
                    >
                      Back to Search
                    </button>
                    <button
                      type="submit"
                      className="watchlist-button-primary"
                      disabled={submitting || !itemKey.trim() || !itemTitle.trim()}
                    >
                      {submitting ? "Adding…" : "Add to Watchlist"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="watchlist-button-secondary"
                    onClick={handleCloseModal}
                  >
                    Close
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
