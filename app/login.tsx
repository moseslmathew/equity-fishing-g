"use client";
import { BarChart3, UserCheck, ShieldCheck } from "lucide-react";
import { useClerkAuth } from "./clerk-client";

export default function Login() {
  const { openSignIn } = useClerkAuth();

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
        <h1>Research & Intelligence</h1>
        <p>Sign in to access fund analytics, portfolio changes, and your personal watchlist.</p>

        <div style={{ marginTop: "24px" }}>
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
        </div>
      </section>
    </main>
  );
}
