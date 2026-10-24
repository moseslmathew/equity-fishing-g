"use client";
import { useEffect } from "react";
import { BarChart3, UserCheck, ShieldCheck, ArrowLeft } from "lucide-react";
import { useClerkAuth } from "./clerk-client";

export default function Login() {
  const { isSignedIn, openSignIn } = useClerkAuth();

  useEffect(() => {
    if (isSignedIn) {
      window.location.replace("/#watchlist");
    }
  }, [isSignedIn]);

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
          <ShieldCheck size={26} />
        </span>
        <h1>Account Sign In</h1>
        <p>Sign in with your account to access, manage, and sync your personal watchlist across devices.</p>

        <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <button
            type="button"
            className="button"
            onClick={openSignIn}
            style={{
              width: "100%",
              padding: "12px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              fontSize: "0.95rem",
              fontWeight: 600,
            }}
          >
            <UserCheck size={18} />
            <span>Sign in with Clerk</span>
          </button>
          <a
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              fontSize: "0.85rem",
              color: "var(--foreground-muted, #71717a)",
              textDecoration: "none",
              padding: "8px",
            }}
          >
            <ArrowLeft size={14} />
            <span>Back to Dashboard (Browse as guest)</span>
          </a>
        </div>
      </section>
    </main>
  );
}
