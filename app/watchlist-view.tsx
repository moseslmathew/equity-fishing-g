"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Bookmark,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GripVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useClerkAuth, getClerkAuthHeaders } from "./clerk-client";
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
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
};

type SortKey = "custom" | "title" | "price" | "change" | "createdAt";
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
  const [tableFilter, setTableFilter] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "custom", dir: 1 });

  // Drag-and-drop arrange state
  const [draggedItemKey, setDraggedItemKey] = useState<string | null>(null);
  const [dragOverItemKey, setDragOverItemKey] = useState<string | null>(null);
  const [dragDropSide, setDragDropSide] = useState<"above" | "below">("above");

  // Live LTP state refreshed automatically on page load & manual Sync
  const [quotes, setQuotes] = useState<Record<string, BatchQuoteEntry | null>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesUpdatedAt, setQuotesUpdatedAt] = useState<string | null>(null);

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
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
        const res = await fetch(`/api/nse?symbols=${encodeURIComponent(chunk.join(","))}`);
        if (!res.ok) continue;
        const data = (await res.json()) as {
          quotes?: Record<string, BatchQuoteEntry | null>;
          asOf?: string | null;
        };
        if (data.quotes) {
          Object.assign(merged, data.quotes);
        }
        if (data.asOf && (!latestTime || Date.parse(data.asOf) > Date.parse(latestTime))) {
          latestTime = data.asOf;
        }
      }
      setQuotes(merged);
      if (latestTime) setQuotesUpdatedAt(latestTime);
    } catch (err) {
      console.warn("Failed to fetch live quotes for watchlist", err);
    } finally {
      setQuotesLoading(false);
    }
  }, []);

  const loadWatchlist = useCallback(async () => {
    try {
      setError("");
      const authHeaders = await getClerkAuthHeaders();
      const res = await fetch("/api/watchlist", {
        headers: authHeaders,
      });
      if (!res.ok) {
        throw new Error(`Failed to load watchlist (HTTP ${res.status})`);
      }
      const data = (await res.json()) as { items?: WatchlistItem[] };
      let list = data.items || [];

      // If user is not logged in or watchlist is empty, check localStorage cache
      if (list.length === 0 && typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("observatory.watchlist.v1");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              for (const sym of parsed) {
                const s = String(sym).trim().toUpperCase();
                if (!s) continue;
                try {
                  const addRes = await fetch("/api/watchlist", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...authHeaders },
                    body: JSON.stringify({
                      itemType: "stock",
                      itemKey: s,
                      itemTitle: s,
                      itemSubtitle: "NSE Equity",
                    }),
                  });
                  if (addRes.ok) {
                    const addedJson = (await addRes.json()) as { item?: WatchlistItem };
                    if (addedJson.item) list.push(addedJson.item);
                  }
                } catch {}
              }
            }
          }
          // Mirror back to localStorage
          const stockKeys = list.filter((i) => i.itemType === "stock").map((i) => i.itemKey.toUpperCase());
          localStorage.setItem("observatory.watchlist.v1", JSON.stringify(stockKeys));
        } catch {}
      }

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
    if (q.length < 1) {
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
  }, [searchQuery]);

  const handleCloseModal = () => {
    setShowAddModal(false);
    setItemKey("");
    setItemTitle("");
    setItemSubtitle("");
    setNotes("");
    setSearchQuery("");
    setCandidates([]);
    setIsManualEdit(false);
    setDirectAddingKey(null);
    setSubmitError("");
  };

  const handleDirectAddStock = async (c: (typeof candidates)[number]) => {
    if (directAddingKey) return;
    setDirectAddingKey(c.symbol);
    setSubmitError("");
    try {
      const authHeaders = await getClerkAuthHeaders();
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
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
            symbol: c.symbol.trim().toUpperCase(),
            series: "EQ",
            price: c.price,
            previousClose: c.close ?? null,
            change: c.price !== null && c.close !== null ? c.price - c.close : null,
            changePercent: c.changePercent ?? null,
            volume: null,
            open: null,
            high: null,
            low: null,
            close: c.close ?? null,
            bandUpper: null,
            bandLower: null,
            source: "live",
            asOf: c.date ?? null,
            asOfIso: c.date ? `${c.date}T15:30:00+05:30` : null,
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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemKey.trim() || !itemTitle.trim()) return;

    setSubmitting(true);
    setSubmitError("");
    try {
      const normalizedKey = itemKey.trim().toUpperCase();
      const authHeaders = await getClerkAuthHeaders();
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          itemType: "stock",
          itemKey: normalizedKey,
          itemTitle: itemTitle.trim(),
          itemSubtitle: itemSubtitle.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = (await res.json()) as { error?: string };
        throw new Error(errorData.error || "Failed to add stock to watchlist");
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

  const handleRemove = async (key: string) => {
    if (!confirm(`Remove ${key} from your personal watchlist?`)) return;

    try {
      const authHeaders = await getClerkAuthHeaders();
      const res = await fetch(`/api/watchlist?itemType=stock&itemKey=${encodeURIComponent(key)}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (res.ok) {
        setItems((prev) => {
          const next = prev.filter((i) => !(i.itemType === "stock" && i.itemKey === key));
          if (typeof window !== "undefined") {
            try {
              const stockKeys = next.filter((i) => i.itemType === "stock").map((i) => i.itemKey.toUpperCase());
              localStorage.setItem("observatory.watchlist.v1", JSON.stringify(stockKeys));
            } catch {}
          }
          return next;
        });
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

  const handleDragStart = (e: React.DragEvent, item: WatchlistItem) => {
    const key = `stock:${item.itemKey}`;
    setDraggedItemKey(key);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", key);
  };

  const handleDragOver = (e: React.DragEvent, targetItem: WatchlistItem) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const targetKey = `stock:${targetItem.itemKey}`;
    if (targetKey === draggedItemKey) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const side = e.clientY < midY ? "above" : "below";

    setDragOverItemKey(targetKey);
    setDragDropSide(side);
  };

  const handleDragEnd = () => {
    setDraggedItemKey(null);
    setDragOverItemKey(null);
  };

  const saveReorderedItems = async (reordered: WatchlistItem[]) => {
    setItems(reordered);
    setSort({ key: "custom", dir: 1 });
    try {
      const authHeaders = await getClerkAuthHeaders();
      await fetch("/api/watchlist", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          orderedItems: reordered.map((i) => ({ itemType: i.itemType, itemKey: i.itemKey })),
        }),
      });
    } catch (err) {
      console.error("Failed to persist reordered watchlist", err);
    }
  };

  const handleDrop = (e: React.DragEvent, targetItem: WatchlistItem) => {
    e.preventDefault();
    if (!draggedItemKey) return;
    const targetKey = `stock:${targetItem.itemKey}`;
    if (targetKey === draggedItemKey) {
      handleDragEnd();
      return;
    }

    const fromIndex = items.findIndex((i) => `stock:${i.itemKey}` === draggedItemKey);
    const toIndex = items.findIndex((i) => `stock:${i.itemKey}` === targetKey);
    if (fromIndex === -1 || toIndex === -1) {
      handleDragEnd();
      return;
    }

    const updated = [...items];
    const [moved] = updated.splice(fromIndex, 1);
    const targetIndexAfterRemoval = updated.findIndex((i) => `stock:${i.itemKey}` === targetKey);
    const insertIndex = dragDropSide === "above" ? targetIndexAfterRemoval : targetIndexAfterRemoval + 1;

    updated.splice(Math.max(0, Math.min(updated.length, insertIndex)), 0, moved);
    handleDragEnd();
    void saveReorderedItems(updated);
  };

  const handleMoveRow = (indexInVisible: number, delta: -1 | 1) => {
    const targetIdx = indexInVisible + delta;
    if (targetIdx < 0 || targetIdx >= visibleItems.length) return;

    const currentItem = visibleItems[indexInVisible];
    const targetItem = visibleItems[targetIdx];

    const fromIndex = items.findIndex((i) => i.itemType === currentItem.itemType && i.itemKey === currentItem.itemKey);
    const toIndex = items.findIndex((i) => i.itemType === targetItem.itemType && i.itemKey === targetItem.itemKey);
    if (fromIndex === -1 || toIndex === -1) return;

    const updated = [...items];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    void saveReorderedItems(updated);
  };

  const visibleItems = useMemo(() => {
    const q = tableFilter.trim().toLowerCase();
    const list = items.filter((item) => {
      if (item.itemType !== "stock") return false;
      if (!q) return true;
      return (
        item.itemKey.toLowerCase().includes(q) ||
        item.itemTitle.toLowerCase().includes(q) ||
        (item.itemSubtitle && item.itemSubtitle.toLowerCase().includes(q))
      );
    });

    if (sort.key === "custom") {
      return list;
    }

    return [...list].sort((a, b) => {
      if (sort.key === "title") {
        return sort.dir * a.itemTitle.localeCompare(b.itemTitle);
      }
      if (sort.key === "price") {
        const pa = quotes[a.itemKey.toUpperCase()]?.price ?? -Infinity;
        const pb = quotes[b.itemKey.toUpperCase()]?.price ?? -Infinity;
        return sort.dir * (pa - pb);
      }
      if (sort.key === "change") {
        const ca = quotes[a.itemKey.toUpperCase()]?.changePercent ?? -Infinity;
        const cb = quotes[b.itemKey.toUpperCase()]?.changePercent ?? -Infinity;
        return sort.dir * (ca - cb);
      }
      return sort.dir * (Date.parse(a.createdAt) - Date.parse(b.createdAt));
    });
  }, [items, tableFilter, sort, quotes]);

  const stockCount = visibleItems.length;
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
          <button className="watchlist-button-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            <span>Add Stock</span>
          </button>
        </div>
      </div>

      {/* Controls Toolbar: Search Filter & Custom Arrange Reset */}
      {(items.length > 0 || sort.key !== "custom") && (
        <div className="watchlist-toolbar">
          <div className="watchlist-toolbar-left">
            {items.length > 0 && (
              <div className="watchlist-table-filter">
                <Search size={14} className="watchlist-filter-icon" aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Filter ticker or company name…"
                  aria-label="Filter watchlist"
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="watchlist-toolbar-right">
            {sort.key !== "custom" && (
              <button
                type="button"
                className="watchlist-custom-sort-btn"
                onClick={() => setSort({ key: "custom", dir: 1 })}
                title="Reset to your custom arranged order"
              >
                <ArrowUpDown size={13} />
                <span>Reset to Custom Order</span>
              </button>
            )}
          </div>
        </div>
      )}

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
          <h3>{tableFilter.trim() ? "No matching watchlist stocks" : "Your watchlist is empty"}</h3>
          <p>
            {tableFilter.trim()
              ? `No saved stocks matched "${tableFilter.trim()}". Clear the search filter to see all items.`
              : "Add NSE equities to track live prices, price charts, concalls, and notes in one table."}
          </p>
          {tableFilter.trim() ? (
            <button className="watchlist-button-secondary" onClick={() => setTableFilter("")}>
              Clear filter
            </button>
          ) : (
            <button className="watchlist-button-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={15} />
              <span>Add your first stock</span>
            </button>
          )}
        </div>
      ) : (
        <div className="watchlist-table-shell">
          <table className="watchlist-table">
            <thead>
              <tr>
                <th scope="col" className="watchlist-col-drag" aria-label="Arrange items">
                  <span className="sr-only">Arrange</span>
                </th>
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
              {visibleItems.map((item, index) => {
                const quote = quotes[item.itemKey.toUpperCase()];
                const sub = displaySubtitle(item);
                const quoteTime = quote ? formatQuoteTimestamp(quote.asOf, quote.asOfIso) : null;
                const href = `/companies/${encodeURIComponent(item.itemKey)}`;
                const pct = quote?.changePercent;
                const hasQuoteLoaded = item.itemKey.toUpperCase() in quotes;
                const itemCompositeKey = `stock:${item.itemKey}`;

                return (
                  <tr
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                    onDragOver={(e) => handleDragOver(e, item)}
                    onDrop={(e) => handleDrop(e, item)}
                    onDragEnd={handleDragEnd}
                    className={`watchlist-row ${
                      draggedItemKey === itemCompositeKey
                        ? "is-dragging"
                        : dragOverItemKey === itemCompositeKey
                        ? dragDropSide === "above"
                          ? "drag-over-above"
                          : "drag-over-below"
                        : ""
                    }`}
                  >
                    <td className="watchlist-cell-drag" onClick={(e) => e.stopPropagation()}>
                      <div className="watchlist-drag-container">
                        <span
                          className="watchlist-drag-handle"
                          title="Drag to arrange items"
                          aria-label={`Drag to arrange ${item.itemTitle}`}
                        >
                          <GripVertical size={16} />
                        </span>
                        <div className="watchlist-reorder-arrows">
                          <button
                            type="button"
                            onClick={() => handleMoveRow(index, -1)}
                            disabled={index === 0}
                            className="watchlist-reorder-btn"
                            title="Move up"
                            aria-label={`Move ${item.itemTitle} up`}
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveRow(index, 1)}
                            disabled={index === visibleItems.length - 1}
                            className="watchlist-reorder-btn"
                            title="Move down"
                            aria-label={`Move ${item.itemTitle} down`}
                          >
                            <ChevronDown size={12} />
                          </button>
                        </div>
                      </div>
                    </td>

                    <td className="watchlist-cell-security" data-label="Security">
                      <div className="watchlist-security-row">
                        <a href={href} className="watchlist-security-link">
                          <span className="watchlist-security-name">{item.itemTitle}</span>
                        </a>
                      </div>
                      {(sub || item.notes) && (
                        <div className="watchlist-security-meta">
                          {sub && <span className="watchlist-security-sector">{sub}</span>}
                          {item.notes && <span className="watchlist-security-note">{item.notes}</span>}
                        </div>
                      )}
                    </td>

                    <td className="is-numeric watchlist-cell-price" data-label="LTP">
                      {quotesLoading && !hasQuoteLoaded ? (
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
                      {quotesLoading && !hasQuoteLoaded ? (
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
                      <a
                        href={href}
                        className="watchlist-row-action watchlist-chart-action"
                        aria-label={`Open price & volume chart for ${item.itemTitle}`}
                        title="Open price & volume chart"
                      >
                        <BarChart3 size={15} />
                      </a>
                      <a
                        href={href}
                        className="watchlist-row-action"
                        aria-label={`Open details for ${item.itemTitle}`}
                        title="Open stock analysis"
                      >
                        <ExternalLink size={15} />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleRemove(item.itemKey)}
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

      {/* Streamlined Stock Search Modal */}
      {showAddModal && (
        <div
          className="watchlist-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          <div className="watchlist-modal-card" role="dialog" aria-modal="true" aria-labelledby="watchlist-modal-title">
            <div className="watchlist-modal-header">
              <h2 id="watchlist-modal-title">{isManualEdit ? "Enter Ticker Manually" : "Add Stock to Watchlist"}</h2>
              <button className="watchlist-modal-close" onClick={handleCloseModal} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>

            {!isManualEdit ? (
              <div className="watchlist-modal-search-body">
                <div className="watchlist-search-input-box">
                  <Search size={18} className="watchlist-search-icon" aria-hidden="true" />
                  <input
                    type="text"
                    className="watchlist-input watchlist-search-hero-input"
                    placeholder="Search NSE stock by symbol or company (e.g. RELIANCE, CDSL, ZETWERK)…"
                    value={searchQuery}
                    onChange={(e) => {
                      const next = e.target.value;
                      setSearchQuery(next);
                      if (next.trim().length < 1) {
                        setCandidates([]);
                        setIsSearching(false);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") handleCloseModal();
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
                        setIsSearching(false);
                      }}
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                </div>

                {/* Candidate Results */}
                {candidates.length > 0 ? (
                  <div className="watchlist-modal-results">
                    <ul className="watchlist-results-list" role="listbox">
                      {candidates.map((c) => {
                        const isAddingThis = directAddingKey === c.symbol;
                        return (
                          <li
                            key={c.symbol}
                            className={`watchlist-modal-result-item ${isAddingThis ? "is-adding" : ""}`}
                            onClick={() => {
                              if (!directAddingKey) void handleDirectAddStock(c);
                            }}
                            role="option"
                            aria-selected={false}
                          >
                            <div className="watchlist-result-left">
                              <div className="watchlist-result-title">
                                <span className="watchlist-result-symbol">{c.symbol}</span>
                                <span className="watchlist-result-name">{c.name}</span>
                              </div>
                              <div className="watchlist-result-meta">
                                <span>{c.sector}</span>
                                {c.isin && <span>· ISIN: {c.isin}</span>}
                              </div>
                            </div>
                            <div className="watchlist-result-right">
                              {isAddingThis ? (
                                <span className="watchlist-adding-indicator">Adding…</span>
                              ) : (
                                <>
                                  {c.price !== null && c.price !== undefined && (
                                    <span className="watchlist-result-price">
                                      ₹{c.price.toLocaleString("en-IN")}
                                    </span>
                                  )}
                                  {c.changePercent !== null && c.changePercent !== undefined && (
                                    <span
                                      className={`watchlist-result-change ${
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
                      })}
                    </ul>
                  </div>
                ) : searchQuery.trim().length >= 1 && !isSearching ? (
                  <div className="watchlist-modal-empty-results">
                    <p>No NSE stocks found for &ldquo;{searchQuery}&rdquo;.</p>
                    <button
                      type="button"
                      className="watchlist-manual-link-btn"
                      onClick={() => {
                        const trimmed = searchQuery.trim();
                        setItemKey(trimmed.toUpperCase().replace(/\s+/g, ""));
                        setItemTitle(trimmed);
                        setIsManualEdit(true);
                      }}
                    >
                      Add &ldquo;{searchQuery.toUpperCase()}&rdquo; manually
                    </button>
                  </div>
                ) : (
                  <div className="watchlist-quick-picks">
                    <span className="watchlist-quick-picks-label">Popular NSE Equities:</span>
                    <div className="watchlist-quick-picks-list">
                      {["RELIANCE", "TCS", "HDFCBANK", "INFY", "TATAMOTORS", "CDSL", "ATHERENERG", "ZETWERK"].map(
                        (sym) => (
                          <button
                            key={sym}
                            type="button"
                            className="watchlist-quick-pill"
                            onClick={() => {
                              setSearchQuery(sym);
                            }}
                          >
                            +{sym}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}

                {submitError && (
                  <p className="error-notice" role="alert" style={{ marginTop: "12px", marginBottom: "0" }}>
                    {submitError}
                  </p>
                )}

                <div className="watchlist-modal-subtle-footer">
                  <button
                    type="button"
                    className="watchlist-manual-toggle"
                    onClick={() => setIsManualEdit(true)}
                  >
                    Can&apos;t find your stock? Enter ticker manually
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAdd}>
                <div className="watchlist-form-group">
                  <label className="watchlist-form-label">NSE Ticker / Symbol</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ZETWERK, ATHERENERG"
                    value={itemKey}
                    onChange={(e) => setItemKey(e.target.value.toUpperCase())}
                    className="watchlist-input"
                    autoFocus
                  />
                </div>

                <div className="watchlist-form-group">
                  <label className="watchlist-form-label">Company Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Zetwerk Manufacturing Businesses Limited"
                    value={itemTitle}
                    onChange={(e) => setItemTitle(e.target.value)}
                    className="watchlist-input"
                  />
                </div>

                <div className="watchlist-form-group">
                  <label className="watchlist-form-label">Sector (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Electric Vehicles, Auto Ancillaries"
                    value={itemSubtitle}
                    onChange={(e) => setItemSubtitle(e.target.value)}
                    className="watchlist-input"
                  />
                </div>

                <div className="watchlist-form-group">
                  <label className="watchlist-form-label">Notes / Thesis (Optional)</label>
                  <textarea
                    placeholder="Target price, thesis, or allocation notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="watchlist-textarea"
                  />
                </div>

                {submitError && (
                  <p className="error-notice" role="alert" style={{ marginBottom: "12px" }}>
                    {submitError}
                  </p>
                )}

                <div className="watchlist-modal-footer">
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
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
