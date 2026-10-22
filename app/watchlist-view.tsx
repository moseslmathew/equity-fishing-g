"use client";

import { useEffect, useState } from "react";
import { Bookmark, Trash2, ExternalLink, Plus, RefreshCw, TrendingUp, Building2, User } from "lucide-react";
import { useClerkAuth } from "./clerk-client";

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

  // Form modal/states
  const [showAddModal, setShowAddModal] = useState(false);
  const [itemType, setItemType] = useState<"stock" | "fund">("stock");
  const [itemKey, setItemKey] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemSubtitle, setItemSubtitle] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      <div className="results-loader" role="status">
        <span className="loading-spinner" aria-hidden="true" />
        <span>Loading your profile…</span>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="state" style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center", padding: "32px 24px" }}>
        <Bookmark size={40} style={{ margin: "0 auto 16px", color: "var(--accent)" }} />
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "8px" }}>Sign in to manage your watchlist</h2>
        <p style={{ color: "var(--muted-foreground)", marginBottom: "24px", lineHeight: 1.5 }}>
          Create a personalized watchlist of Indian equities, small-cap schemes, and tracked funds. Your watchlist is synced to your account.
        </p>
        <button className="button" style={{ padding: "10px 24px", fontSize: "0.95rem" }} onClick={openSignIn}>
          Sign in with Clerk
        </button>
      </div>
    );
  }

  const filteredItems = items.filter((item) => activeTab === "all" || item.itemType === activeTab);

  return (
    <div className="watchlist-container" style={{ padding: "8px 0" }}>
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "24px",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "16px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
            <Bookmark size={24} style={{ color: "var(--accent)" }} />
            Personal Watchlist
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted-foreground)", fontSize: "0.9rem" }}>
            Track your target stocks and funds · Signed in as {user?.fullName || user?.primaryEmailAddress?.emailAddress || "User"}
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            className="quiet-button"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
            onClick={() => void loadWatchlist()}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "refresh-spinning" : undefined} />
            <span>Sync</span>
          </button>
          <button
            className="button"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} />
            <span>Add to Watchlist</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
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
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "0.85rem",
              fontWeight: activeTab === tab.id ? 600 : 400,
              backgroundColor: activeTab === tab.id ? "var(--accent)" : "transparent",
              color: activeTab === tab.id ? "white" : "var(--foreground)",
              border: "1px solid",
              borderColor: activeTab === tab.id ? "var(--accent)" : "var(--border)",
              cursor: "pointer",
            }}
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
        <div
          style={{
            textAlign: "center",
            padding: "48px 24px",
            border: "1px dashed var(--border)",
            borderRadius: "8px",
            backgroundColor: "var(--card)",
          }}
        >
          <Bookmark size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "6px" }}>Your watchlist is empty</h3>
          <p style={{ color: "var(--muted-foreground)", fontSize: "0.875rem", marginBottom: "16px" }}>
            Add Indian small-cap equities or mutual fund schemes to monitor them here.
          </p>
          <button className="button" onClick={() => setShowAddModal(true)}>
            Add your first item
          </button>
        </div>
      ) : (
        /* Grid of Watchlisted Items */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "16px",
          }}
        >
          {filteredItems.map((item) => (
            <div
              key={item.id}
              style={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        backgroundColor: item.itemType === "stock" ? "rgba(37, 99, 235, 0.1)" : "rgba(16, 185, 129, 0.1)",
                        color: item.itemType === "stock" ? "rgb(37, 99, 235)" : "rgb(16, 185, 129)",
                      }}
                    >
                      {item.itemType === "stock" ? <TrendingUp size={12} style={{ marginRight: "4px" }} /> : <Building2 size={12} style={{ marginRight: "4px" }} />}
                      {item.itemType.toUpperCase()}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "var(--muted-foreground)" }}>
                      {item.itemKey}
                    </span>
                  </div>

                  <button
                    onClick={() => handleRemove(item.itemType, item.itemKey)}
                    aria-label={`Remove ${item.itemTitle}`}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--muted-foreground)",
                      cursor: "pointer",
                      padding: "4px",
                    }}
                    title="Remove from watchlist"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <h3 style={{ fontSize: "1.05rem", fontWeight: 600, margin: "0 0 4px" }}>
                  {item.itemTitle}
                </h3>
                {item.itemSubtitle && (
                  <p style={{ fontSize: "0.85rem", color: "var(--muted-foreground)", margin: "0 0 10px" }}>
                    {item.itemSubtitle}
                  </p>
                )}

                {item.notes && (
                  <div
                    style={{
                      backgroundColor: "var(--background)",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      fontSize: "0.85rem",
                      borderLeft: "3px solid var(--accent)",
                      marginTop: "8px",
                      marginBottom: "8px",
                    }}
                  >
                    {item.notes}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "16px",
                  paddingTop: "12px",
                  borderTop: "1px solid var(--border)",
                  fontSize: "0.8rem",
                }}
              >
                <span style={{ color: "var(--muted-foreground)" }}>
                  Added {new Date(item.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                </span>

                {item.itemType === "stock" ? (
                  <a
                    href={`/companies/${encodeURIComponent(item.itemKey)}`}
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}
                  >
                    Deep dive <ExternalLink size={13} />
                  </a>
                ) : (
                  <a
                    href={`/#${encodeURIComponent(item.itemKey)}`}
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}
                  >
                    View Fund <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--card)",
              borderRadius: "8px",
              padding: "24px",
              maxWidth: "460px",
              width: "100%",
              border: "1px solid var(--border)",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 16px" }}>Add to Watchlist</h2>
            <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>Type</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.9rem", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="itemType"
                      checked={itemType === "stock"}
                      onChange={() => setItemType("stock")}
                    />
                    Stock / Company
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.9rem", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="itemType"
                      checked={itemType === "fund"}
                      onChange={() => setItemType("fund")}
                    />
                    Mutual Fund
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                  {itemType === "stock" ? "NSE Symbol / Ticker" : "Fund Code / Identifier"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={itemType === "stock" ? "e.g. CDSL, TATAELXSI" : "e.g. quant-small-cap"}
                  value={itemKey}
                  onChange={(e) => setItemKey(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--background)",
                    color: "var(--foreground)",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                  Name / Title
                </label>
                <input
                  type="text"
                  required
                  placeholder={itemType === "stock" ? "e.g. Central Depository Services" : "e.g. Quant Small Cap Fund"}
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--background)",
                    color: "var(--foreground)",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                  Sector / Category (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Capital Markets, Technology"
                  value={itemSubtitle}
                  onChange={(e) => setItemSubtitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--background)",
                    color: "var(--foreground)",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                  Personal Notes / Thesis (Optional)
                </label>
                <textarea
                  placeholder="Add your target price, key thesis, or monitoring note..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--background)",
                    color: "var(--foreground)",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  className="quiet-button"
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="button" disabled={submitting}>
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
