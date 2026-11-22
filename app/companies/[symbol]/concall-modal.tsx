"use client";

import { useState, useMemo, useEffect } from "react";
import {
  X,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Target,
  AlertTriangle,
  MessageSquareQuote,
  CheckCircle2,
  Users,
  Search,
  Filter,
  Volume2,
  Calendar,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { ConcallAnalysis, ConcallQAItem } from "../../../lib/concall-analysis";
import "./concall-modal.css";

interface ConcallModalProps {
  symbol: string;
  companyName: string;
  onClose: () => void;
}

export default function ConcallModal({
  symbol,
  companyName,
  onClose,
}: ConcallModalProps) {
  const [data, setData] = useState<ConcallAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"parameters" | "qa" | "executives">("parameters");
  const [filterCongratsOnly, setFilterCongratsOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedQaIds, setExpandedQaIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetch(`/api/concall?symbol=${encodeURIComponent(symbol)}&name=${encodeURIComponent(companyName)}`, {
      cache: "no-store",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Concall analysis currently unavailable");
        return res.json();
      })
      .then((json: ConcallAnalysis) => {
        if (isMounted) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load concall analysis");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [symbol, companyName]);

  const toggleQaExpand = (id: string) => {
    setExpandedQaIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredQaList = useMemo(() => {
    if (!data?.qaList) return [];
    return data.qaList.filter((item) => {
      if (filterCongratsOnly && !item.congratulated) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.analystName.toLowerCase().includes(q) ||
        item.institution.toLowerCase().includes(q) ||
        item.topic.toLowerCase().includes(q) ||
        item.question.toLowerCase().includes(q) ||
        item.response.toLowerCase().includes(q) ||
        item.keyTakeaway.toLowerCase().includes(q)
      );
    });
  }, [data?.qaList, filterCongratsOnly, searchQuery]);

  return (
    <div
      className="concall-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="concall-modal-title"
    >
      <div
        className="concall-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="concall-modal-header">
          <div className="concall-modal-heading">
            <div className="concall-badge-row">
              <span className="concall-quarter-badge">{data?.quarter ?? "Latest Concall"}</span>
              <span className="concall-meta-item">
                <Calendar size={13} />
                {data?.callDate ?? "Q2 FY25"}
              </span>
              <span className="concall-meta-item">
                <Clock size={13} />
                {data?.durationMinutes ?? 60} mins
              </span>
              {data?.audioAvailable && (
                <span className="concall-audio-badge">
                  <Volume2 size={12} />
                  Audio Synced
                </span>
              )}
            </div>
            <h2 id="concall-modal-title">
              {companyName} <span className="concall-sub-symbol">({symbol})</span>
            </h2>
            <p className="concall-subtitle">
              Earnings Conference Call & Management Q&A Forensic Analysis
            </p>
          </div>

          <button
            type="button"
            className="concall-close-btn"
            onClick={onClose}
            aria-label="Close concall analysis"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="concall-loading-state">
            <div className="concall-spinner" />
            <p>Decoding earnings call transcript & forensic parameters…</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="concall-error-state">
            <AlertTriangle size={24} className="text-amber-500" />
            <p>{error}</p>
            <button onClick={() => window.location.reload()} className="concall-retry-btn">
              Retry
            </button>
          </div>
        )}

        {/* Main Content */}
        {!loading && data && (
          <div className="concall-modal-body">
            {/* ITEM 3: CONGRATULATIONS COUNTER & SENTIMENT BANNER */}
            <div className="concall-congrats-card">
              <div className="concall-congrats-left">
                <div className="concall-congrats-icon-wrap">
                  <Sparkles size={22} className="concall-congrats-icon" />
                </div>
                <div>
                  <div className="concall-congrats-title-row">
                    <span className="concall-congrats-count-badge">
                      {data.congratulations.count} Analyst Congratulations
                    </span>
                    <span className="concall-congrats-label">Forensic Flattery Index</span>
                  </div>
                  <p className="concall-congrats-takeaway">
                    {data.congratulations.forensicTakeaway}
                  </p>
                </div>
              </div>

              {data.congratulations.analystsCongratulating.length > 0 && (
                <div className="concall-congrats-analysts">
                  <span className="concall-congrats-analysts-title">Praise offered by:</span>
                  <div className="concall-congrats-tags">
                    {data.congratulations.analystsCongratulating.map((analyst, i) => (
                      <span key={i} className="concall-analyst-tag">
                        {analyst}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Tabs */}
            <div className="concall-tabs">
              <button
                type="button"
                className={`concall-tab-btn ${activeTab === "parameters" ? "is-active" : ""}`}
                onClick={() => setActiveTab("parameters")}
              >
                <ShieldCheck size={15} />
                <span>Interpretation & Parameters</span>
              </button>
              <button
                type="button"
                className={`concall-tab-btn ${activeTab === "qa" ? "is-active" : ""}`}
                onClick={() => setActiveTab("qa")}
              >
                <MessageSquareQuote size={15} />
                <span>Analyst Q&A ({data.qaList.length})</span>
              </button>
              <button
                type="button"
                className={`concall-tab-btn ${activeTab === "executives" ? "is-active" : ""}`}
                onClick={() => setActiveTab("executives")}
              >
                <Users size={15} />
                <span>Executive Panel ({data.executives.length})</span>
              </button>
            </div>

            {/* TAB 1: INTERPRETATION ON VARIOUS PARAMETERS */}
            {activeTab === "parameters" && (
              <div className="concall-tab-content concall-parameters-grid">
                {/* 1. Result Quality */}
                <div className="concall-param-card">
                  <div className="concall-param-header">
                    <div className="concall-param-title-wrap">
                      <TrendingUp size={16} className="text-emerald-600" />
                      <h3>Result Quality</h3>
                    </div>
                    <span
                      className={`concall-status-badge is-${data.parameters.resultQuality.tone}`}
                    >
                      {data.parameters.resultQuality.status}
                    </span>
                  </div>
                  <p className="concall-param-summary">
                    {data.parameters.resultQuality.summary}
                  </p>
                  <div className="concall-metrics-list">
                    {data.parameters.resultQuality.metrics.map((m, idx) => (
                      <div key={idx} className="concall-metric-item">
                        <div className="concall-metric-header">
                          <span className="concall-metric-label">{m.label}</span>
                          <span className={`concall-metric-val is-${m.assessment}`}>
                            {m.value}
                          </span>
                        </div>
                        <span className="concall-metric-detail">{m.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Management Confidence */}
                <div className="concall-param-card">
                  <div className="concall-param-header">
                    <div className="concall-param-title-wrap">
                      <ShieldCheck size={16} className="text-indigo-600" />
                      <h3>Management Confidence</h3>
                    </div>
                    <span
                      className={`concall-status-badge is-${data.parameters.managementConfidence.tone}`}
                    >
                      {data.parameters.managementConfidence.level}
                    </span>
                  </div>
                  <p className="concall-param-summary">
                    {data.parameters.managementConfidence.summary}
                  </p>
                  <div className="concall-signals-list">
                    <span className="concall-signals-title">Key Management Signals:</span>
                    {data.parameters.managementConfidence.keySignals.map((sig, idx) => (
                      <div key={idx} className="concall-signal-item">
                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                        <span>{sig}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Guidance & Forward Outlook */}
                <div className="concall-param-card">
                  <div className="concall-param-header">
                    <div className="concall-param-title-wrap">
                      <Target size={16} className="text-purple-600" />
                      <h3>Guidance & Outlook</h3>
                    </div>
                    <span
                      className={`concall-status-badge is-${data.parameters.guidanceOutlook.tone}`}
                    >
                      {data.parameters.guidanceOutlook.stance}
                    </span>
                  </div>
                  <p className="concall-param-summary">
                    {data.parameters.guidanceOutlook.summary}
                  </p>
                  <div className="concall-targets-list">
                    {data.parameters.guidanceOutlook.targets.map((tgt, idx) => (
                      <div key={idx} className="concall-target-row">
                        <div className="concall-target-metric-col">
                          <strong>{tgt.metric}</strong>
                          <span className="concall-target-note">{tgt.note}</span>
                        </div>
                        <span className="concall-target-val">{tgt.target}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Headwinds & Key Risks */}
                <div className="concall-param-card">
                  <div className="concall-param-header">
                    <div className="concall-param-title-wrap">
                      <AlertTriangle size={16} className="text-amber-600" />
                      <h3>Headwinds & Operational Risks</h3>
                    </div>
                    <span className="concall-status-badge is-warning">Scrutiny Focus</span>
                  </div>
                  <p className="concall-param-summary">
                    {data.parameters.headwindsAndRisks.summary}
                  </p>
                  <div className="concall-headwinds-list">
                    {data.parameters.headwindsAndRisks.points.map((pt, idx) => (
                      <div key={idx} className="concall-headwind-item">
                        <span className="concall-headwind-bullet" />
                        <span>{pt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: QUESTIONS AND ANSWERS ASKED */}
            {activeTab === "qa" && (
              <div className="concall-tab-content concall-qa-view">
                {/* Search & Filter Toolbar */}
                <div className="concall-qa-toolbar">
                  <div className="concall-search-box">
                    <Search size={14} className="concall-search-icon" />
                    <input
                      type="text"
                      placeholder="Search questions by analyst, firm, or topic…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="concall-search-input"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="concall-search-clear"
                        type="button"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setFilterCongratsOnly(!filterCongratsOnly)}
                    className={`concall-filter-toggle ${filterCongratsOnly ? "is-active" : ""}`}
                  >
                    <Sparkles size={13} />
                    <span>Congratulated Calls ({data.congratulations.count})</span>
                  </button>
                </div>

                {/* Q&A List */}
                <div className="concall-qa-list">
                  {filteredQaList.length === 0 ? (
                    <div className="concall-qa-empty">
                      <Filter size={20} className="text-slate-400" />
                      <p>No questions matched your search criteria.</p>
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setFilterCongratsOnly(false);
                        }}
                        className="concall-reset-filter-btn"
                      >
                        Reset filters
                      </button>
                    </div>
                  ) : (
                    filteredQaList.map((qa) => {
                      const isExpanded = expandedQaIds[qa.id] ?? true;
                      return (
                        <div key={qa.id} className="concall-qa-card">
                          <div
                            className="concall-qa-header"
                            onClick={() => toggleQaExpand(qa.id)}
                          >
                            <div className="concall-qa-meta">
                              <span className="concall-qa-analyst">
                                {qa.analystName}
                              </span>
                              <span className="concall-qa-inst">
                                {qa.institution}
                              </span>
                              <span className="concall-qa-topic">{qa.topic}</span>
                              {qa.congratulated && (
                                <span className="concall-qa-congrats-badge">
                                  🎉 Congratulated Result
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              className="concall-qa-collapse-btn"
                              aria-label={isExpanded ? "Collapse Q&A" : "Expand Q&A"}
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="concall-qa-body">
                              {qa.congratulationQuote && (
                                <div className="concall-qa-flattery-quote">
                                  <em>&ldquo;{qa.congratulationQuote}&rdquo;</em>
                                </div>
                              )}

                              <div className="concall-qa-exchange">
                                <div className="concall-qa-question-block">
                                  <span className="concall-qa-role-badge analyst">Q</span>
                                  <div className="concall-qa-text">
                                    <strong>Analyst Question:</strong>
                                    <p>{qa.question}</p>
                                  </div>
                                </div>

                                <div className="concall-qa-answer-block">
                                  <span className="concall-qa-role-badge management">A</span>
                                  <div className="concall-qa-text">
                                    <strong>{qa.speaker}:</strong>
                                    <p>{qa.response}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="concall-qa-takeaway">
                                <span className="concall-takeaway-label">Forensic Takeaway:</span>
                                <span>{qa.keyTakeaway}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: EXECUTIVE PANEL & TRANSCRIPT DETAILS */}
            {activeTab === "executives" && (
              <div className="concall-tab-content concall-exec-view">
                <div className="concall-exec-card">
                  <h3>Management Representatives on the Call</h3>
                  <p className="concall-exec-desc">
                    Key executive participants responsible for quarterly disclosures and guidance commitments.
                  </p>
                  <div className="concall-exec-grid">
                    {data.executives.map((exec, idx) => (
                      <div key={idx} className="concall-exec-item">
                        <div className="concall-exec-avatar">
                          {exec.name
                            .split(" ")
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <div>
                          <strong>{exec.name}</strong>
                          <span>{exec.designation}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="concall-notes-card">
                  <h3>Conference Call Governance & Disclaimer</h3>
                  <div className="concall-notes-content">
                    <p>
                      <strong>Filing Verification:</strong> Earnings call transcript synthesized from verified corporate exchange filings and investor presentations under Regulation 30 of the SEBI (LODR) Regulations, 2015.
                    </p>
                    <p>
                      <strong>Forensic Flattery Index:</strong> Analyst congratulations count reflects verbal praise uttered by sell-side institutional research analysts prior to asking questions. Excessive congratulations typically correlates with optimistic consensus and reduced operational pushback.
                    </p>
                    <p>
                      <strong>Forward-Looking Statements:</strong> Forward statements regarding capacity ramp-ups, order execution, and margin targets are subject to macroeconomic risks, commodity costs, and supply chain lead times.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
