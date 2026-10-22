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

      setItemKey("");
      setItemTitle("");
      setItemSubtitle("");
      setNotes("");
      setShowAddModal(false);
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
                onClick={() => setShowAddModal(false)}
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
                    onClick={() => setItemType("stock")}
                    className={`watchlist-type-option ${itemType === "stock" ? "is-selected" : ""}`}
                  >
                    <TrendingUp size={14} />
                    <span>Stock / Equity</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemType("fund")}
                    className={`watchlist-type-option ${itemType === "fund" ? "is-selected" : ""}`}
                  >
                    <Building2 size={14} />
                    <span>Mutual Fund</span>
                  </button>
                </div>
              </div>

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

              <div className="watchlist-form-group">
                <label className="watchlist-form-label">
                  {itemType === "stock" ? "NSE Ticker / Symbol" : "Fund Identifier"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={itemType === "stock" ? "e.g. CDSL, TATAELXSI" : "e.g. nippon, quant-small-cap"}
                  value={itemKey}
                  onChange={(e) => setItemKey(e.target.value)}
                  className="watchlist-input"
                  autoFocus
                />
              </div>

              <div className="watchlist-form-group">
                <label className="watchlist-form-label">Name / Display Title</label>
                <input
                  type="text"
                  required
                  placeholder={
                    itemType === "stock"
                      ? "e.g. Central Depository Services India"
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
                  placeholder={itemType === "stock" ? "e.g. Capital Markets" : "e.g. Small Cap Fund"}
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

              <div className="watchlist-modal-footer">
                <button
                  type="button"
                  className="watchlist-button-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="watchlist-button-primary"
                  disabled={submitting}
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
