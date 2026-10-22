"use client";
import { useState } from "react";
import { BarChart3, LockKeyhole, Eye, EyeOff, UserCheck } from "lucide-react";
import { useClerkAuth } from "./clerk-client";

export default function Login() {
  const { openSignIn } = useClerkAuth();
  const [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to sign in.");
      window.location.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-brand">
        <span className="brand-mark">
          <BarChart3 size={22} />
        </span>
        <span>
          Smallcap<span className="brand-sub">OBSERVATORY</span>
        </span>
      </div>
      <section className="login-card">
        <span className="login-lock">
          <LockKeyhole size={24} />
        </span>
        <h1>Research & Intelligence</h1>
        <p>Sign in to access fund analytics, ace portfolios, and your personal watchlist.</p>

        {/* Primary User Auth: Clerk */}
        <div style={{ marginTop: "16px", marginBottom: "20px" }}>
          <button
            type="button"
            className="button"
            onClick={openSignIn}
            style={{
              width: "100%",
              padding: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              fontSize: "0.95rem",
              fontWeight: 600,
            }}
          >
            <UserCheck size={18} />
            <span>Sign in with Account (Clerk)</span>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", margin: "16px 0", gap: "12px" }}>
          <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border)" }} />
          <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", textTransform: "uppercase" }}>
            or access code
          </span>
          <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border)" }} />
        </div>

        <form onSubmit={submit}>
          <label htmlFor="password">Access Code</label>
          <div className="password-field">
            <input
              id="password"
              name="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              aria-label={show ? "Hide password" : "Show password"}
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          <button className="quiet-button" style={{ width: "100%", marginTop: "8px" }} disabled={busy} type="submit">
            {busy ? "Validating…" : "Submit code"}
          </button>
        </form>
      </section>
    </main>
  );
}
