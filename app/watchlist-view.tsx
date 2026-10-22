"use client";

import { useEffect, useState } from "react";
import {
  Bookmark,
  Trash2,
  ExternalLink,
  Plus,
  RefreshCw,
  TrendingUp,
  Building2,
  X,
  Search,
  CheckCircle2,
} from "lucide-react";
import { useClerkAuth } from "./clerk-client";
import { fundCatalog } from "../lib/fund-catalog";
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

export default function WatchlistView() {
  const { isLoaded, isSignedIn, user, openSignIn } = useClerkAuth();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "stock" | "fund">("all");

  // Form modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [itemType, setItemType] = useState<"stock" | "fund">("stock");
  const [itemKey, setItemKey] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemSubtitle, setItemSubtitle] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Autocomplete & live quote states for Stock
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
  const [liveQuote, setLiveQuote] = useState<{
    price: number | null;
    change: number | null;
    changePercent: number | null;
    series?: string | null;
  } | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [isManualEdit, setIsManualEdit] = useState(false);

  // Debounced search on typing company name or symbol
  useEffect(() => {
    if (itemType !== "stock") {
      setCandidates([]);
      setShowDropdown(false);
      return;
    }
    const q = searchQuery.trim();
    if (q.length < 1) {
      setCandidates([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }

    let active = true;
    setIsSearching(true);
    const timeout = setTimeout(async () => {
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

  const handleSelectStock = async (c: (typeof candidates)[number]) => {
    setItemKey(c.symbol);
    setItemTitle(c.name);
    setItemSubtitle(c.sector || "Equity");
    setSearchQuery("");
    setShowDropdown(false);
    setCandidates([]);
    setIsManualEdit(false);

    if (c.price !== null) {
      setLiveQuote({
        price: c.price,
        change: null,
        changePercent: c.changePercent,
      });
    }

    setLoadingQuote(true);
    try {
      const res = await fetch(`/api/nse?symbol=${encodeURIComponent(c.symbol)}`);
      if (res.ok) {
        const snap = (await res.json()) as {
          live?: {
            price: number | null;
            change: number | null;
            changePercent: number | null;
            series?: string | null;
          } | null;
        };
        if (snap.live) {
          setLiveQuote({
            price: snap.live.price,
            change: snap.live.change,
            changePercent: snap.live.changePercent,
            series: snap.live.series,
          });
        }
      }
    } catch {
      // Retain cached quote if live fetch had an issue
    } finally {
      setLoadingQuote(false);
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setItemKey("");
    setItemTitle("");
    setItemSubtitle("");
    setNotes("");
    setSearchQuery("");
    setCandidates([]);
    setShowDropdown(false);
    setLiveQuote(null);
    setIsManualEdit(false);
  };

  // Quick picker helpers for funds
  const handleSelectPredefinedFund = (fundId: string) => {
    const found = fundCatalog.find((f) => f.id === fundId);
    if (found) {
      setItemKey(found.id);
      setItemTitle(found.name);
      setItemSubtitle("Indian Mutual Fund Scheme");
    }
  };

  const loadWatchlist = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/watchlist");
      if (!res.ok) {
        if (res.status === 401) {
          setItems([]);
          return;
        }
        throw new Error("Failed to load watchlist");
      }
      const data = (await res.json()) as { items?: WatchlistItem[] };
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load watchlist");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSignedIn) {
      void loadWatchlist();
    } else if (isLoaded) {
      setLoading(false);
    }
  }, [isSignedIn, isLoaded]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemKey.trim() || !itemTitle.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType,
          itemKey: itemKey.trim().toUpperCase(),
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
      await loadWatchlist();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error adding to watchlist");
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

  if (!isLoaded) {
    return (
      <div className="results-loader" role="status" style={{ padding: "40px" }}>
        <span className="loading-spinner" aria-hidden="true" />
        <span>Loading your profile…</span>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="watchlist-empty">
        <div className="watchlist-empty-icon">
          <Bookmark size={28} />
        </div>
        <h3>Sign in to manage your watchlist</h3>
        <p>
          Create a personalized watchlist of Indian equities, small-cap schemes, and tracked funds. Your watchlist is synced to your account.
        </p>
        <button className="watchlist-button-primary" onClick={openSignIn}>
          Sign in with Clerk
        </button>
      </div>
    );
  }

  const filteredItems = items.filter((item) => activeTab === "all" || item.itemType === activeTab);

  return (
    <div className="watchlist-page">
      {/* Header Bar */}
      <div className="watchlist-header">
        <div className="watchlist-header-copy">
          <h1>
            <span className="watchlist-badge-icon">
              <Bookmark size={20} />
            </span>
            Personal Watchlist
          </h1>
          <p>
            Track your target stocks and mutual funds · {user?.fullName || user?.primaryEmailAddress?.emailAddress || "Account"}
          </p>
        </div>

        <div className="watchlist-actions">
          <button
            className="watchlist-button-secondary"
            onClick={() => void loadWatchlist()}
            disabled={loading}
            title="Refresh watchlist"
          >
            <RefreshCw size={15} className={loading ? "refresh-spinning" : undefined} />
            <span>Sync</span>
          </button>
          <button
            className="watchlist-button-primary"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} />
            <span>Add to Watchlist</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="watchlist-tabs">
        {(
          [
            { id: "all", label: `All (${items.length})` },
            { id: "stock", label: `Stocks (${items.filter((i) => i.itemType === "stock").length})` },
            { id: "fund", label: `Funds (${items.filter((i) => i.itemType === "fund").length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`watchlist-tab-button ${activeTab === tab.id ? "is-active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading & Empty States */}
      {loading ? (
        <div className="results-loader" role="status" style={{ padding: "40px" }}>
          <span className="loading-spinner" aria-hidden="true" />
          <span>Refreshing watchlist…</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="watchlist-empty">
          <div className="watchlist-empty-icon">
            <Bookmark size={28} />
          </div>
          <h3>Your watchlist is empty</h3>
          <p>
            Add Indian equities or mutual fund schemes to track key allocations and notes in one place.
          </p>
          <button className="watchlist-button-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={15} />
            <span>Add your first item</span>
          </button>
        </div>
      ) : (
        /* Grid of Watchlisted Items */
        <div className="watchlist-grid">
          {filteredItems.map((item) => (
            <div key={item.id} className="watchlist-card">
              <div>
                <div className="watchlist-card-top">
                  <div className="watchlist-card-tags">
                    <span className={`watchlist-tag ${item.itemType}`}>
                      {item.itemType === "stock" ? (
                        <TrendingUp size={12} />
                      ) : (
                        <Building2 size={12} />
                      )}
                      <span>{item.itemType}</span>
                    </span>
                    <span className="watchlist-ticker">{item.itemKey}</span>
                  </div>

                  <button
                    onClick={() => handleRemove(item.itemType, item.itemKey)}
                    className="watchlist-remove-btn"
                    aria-label={`Remove ${item.itemTitle}`}
                    title="Remove from watchlist"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <h3 className="watchlist-card-title">{item.itemTitle}</h3>
                {item.itemSubtitle && (
                  <p className="watchlist-card-subtitle">{item.itemSubtitle}</p>
                )}

                {item.notes && (
                  <div className="watchlist-card-notes">{item.notes}</div>
                )}
              </div>

              <div className="watchlist-card-footer">
                <span className="watchlist-card-date">
                  Added{" "}
                  {new Date(item.createdAt).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>

                {item.itemType === "stock" ? (
                  <a
                    href={`/companies/${encodeURIComponent(item.itemKey)}`}
                    className="watchlist-card-link"
                  >
                    <span>Deep dive</span>
                    <ExternalLink size={13} />
                  </a>
                ) : (
                  <a
                    href={`/#${encodeURIComponent(item.itemKey)}`}
                    className="watchlist-card-link"
                  >
                    <span>View Fund</span>
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Solid, Opaque Add Modal */}
      {showAddModal && (
        <div
          className="watchlist-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div className="watchlist-modal-card" role="dialog" aria-modal="true">
            <div className="watchlist-modal-header">
              <h2>Add to Watchlist</h2>
              <button
                className="watchlist-modal-close"
                onClick={handleCloseModal}
                aria-label="Close modal"
              >
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
                      setLiveQuote(null);
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
                      setLiveQuote(null);
                    }}
                    className={`watchlist-type-option ${itemType === "fund" ? "is-selected" : ""}`}
                  >
                    <Building2 size={14} />
                    <span>Mutual Fund</span>
                  </button>
                </div>
              </div>

              {itemType === "stock" && !itemKey && (
                <div className="watchlist-form-group">
                  <label className="watchlist-form-label">
                    Search Security by Company Name or Ticker
                  </label>
                  <div className="watchlist-search-wrapper">
                    <div className="watchlist-search-input-box">
                      <Search size={16} className="watchlist-search-icon" />
                      <input
                        type="text"
                        className="watchlist-input"
                        placeholder="Type company name or ticker, e.g. Ather, Tata, CDSL..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          if (!showDropdown && e.target.value.trim().length >= 1) {
                            setShowDropdown(true);
                          }
                        }}
                        onFocus={() => {
                          if (candidates.length > 0) setShowDropdown(true);
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
                            setShowDropdown(false);
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
                          candidates.map((c) => (
                            <li
                              key={c.symbol}
                              className="watchlist-suggestion-item"
                              onClick={() => handleSelectStock(c)}
                              role="option"
                              aria-selected={itemKey === c.symbol}
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
                              {c.price !== null && c.price !== undefined && (
                                <div className="watchlist-suggestion-right">
                                  <span className="watchlist-suggestion-price">
                                    ₹{c.price.toLocaleString("en-IN")}
                                  </span>
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
                                </div>
                              )}
                            </li>
                          ))
                        ) : !isSearching && searchQuery.trim().length >= 1 ? (
                          <li className="watchlist-suggestions-empty">
                            No matching NSE equity found for "{searchQuery}". You can enter details manually below.
                          </li>
                        ) : null}
                      </ul>
                    )}
                  </div>
                  {!isManualEdit && (
                    <button
                      type="button"
                      className="watchlist-manual-toggle"
                      onClick={() => setIsManualEdit(true)}
                    >
                      Or enter ticker details manually
                    </button>
                  )}
                </div>
              )}

              {itemType === "stock" && itemKey && itemTitle && (
                <div className="watchlist-selected-card">
                  <div className="watchlist-selected-header">
                    <span className="watchlist-selected-badge">{itemKey}</span>
                    <span className="watchlist-selected-verified">
                      <CheckCircle2 size={12} />
                      <span>NSE Verified</span>
                    </span>
                    <button
                      type="button"
                      className="watchlist-selected-change-btn"
                      onClick={() => {
                        setItemKey("");
                        setItemTitle("");
                        setItemSubtitle("");
                        setLiveQuote(null);
                        setSearchQuery("");
                      }}
                    >
                      Change Security
                    </button>
                  </div>
                  <h4 className="watchlist-selected-title">{itemTitle}</h4>
                  <p className="watchlist-selected-sector">{itemSubtitle || "Equity"}</p>
                  {(liveQuote?.price || loadingQuote) && (
                    <div className="watchlist-selected-quote">
                      {loadingQuote ? (
                        <span className="watchlist-selected-quote-note">
                          Fetching live quote from NSE MCP…
                        </span>
                      ) : (
                        <>
                          <span className="watchlist-selected-price">
                            ₹{liveQuote?.price?.toLocaleString("en-IN")}
                          </span>
                          {liveQuote?.changePercent !== null &&
                            liveQuote?.changePercent !== undefined && (
                              <span
                                className={`watchlist-selected-change ${
                                  liveQuote.changePercent >= 0 ? "positive" : "negative"
                                }`}
                              >
                                {liveQuote.changePercent >= 0 ? "+" : ""}
                                {liveQuote.changePercent.toFixed(2)}%
                              </span>
                            )}
                          <span className="watchlist-selected-quote-note">
                            Live via NSE MCP
                          </span>
                        </>
                      )}
                    </div>
                  )}
                  {!isManualEdit && (
                    <div style={{ marginTop: "10px" }}>
                      <button
                        type="button"
                        className="watchlist-manual-toggle"
                        onClick={() => setIsManualEdit(true)}
                      >
                        Customize title or sector
                      </button>
                    </div>
                  )}
                </div>
              )}

              {itemType === "fund" && (
                <div className="watchlist-form-group">
                  <label className="watchlist-form-label">Quick Select Tracked Scheme</label>
                  <select
                    className="watchlist-input"
                    onChange={(e) => handleSelectPredefinedFund(e.target.value)}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Choose a fund or enter manually below...
                    </option>
                    {fundCatalog.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Show editable fields only if mutual fund or manual edit is requested or no stock selected yet in manual mode */}
              {(itemType === "fund" || isManualEdit) && (
                <>
                  <div className="watchlist-form-group">
                    <label className="watchlist-form-label">
                      {itemType === "stock" ? "NSE Ticker / Symbol" : "Fund Identifier"}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={
                        itemType === "stock"
                          ? "e.g. CDSL, ATHERENERG"
                          : "e.g. nippon, quant-small-cap"
                      }
                      value={itemKey}
                      onChange={(e) => setItemKey(e.target.value.toUpperCase())}
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
                          ? "e.g. Ather Energy Limited"
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
                      placeholder={
                        itemType === "stock" ? "e.g. Electric Vehicles" : "e.g. Small Cap Fund"
                      }
                      value={itemSubtitle}
                      onChange={(e) => setItemSubtitle(e.target.value)}
                      className="watchlist-input"
                    />
                  </div>
                </>
              )}

              <div className="watchlist-form-group">
                <label className="watchlist-form-label">Notes / Thesis (Optional)</label>
                <textarea
                  placeholder="Target price, allocation strategy, or why you are monitoring this..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="watchlist-textarea"
                />
              </div>

              <div className="watchlist-modal-footer">
                <button
                  type="button"
                  className="watchlist-button-secondary"
                  onClick={handleCloseModal}
                  disabled={submitting}
                >
                  Cancel
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
          </div>
        </div>
      )}
    </div>
  );
}
