"use client";
import { BarChart3, User, LogOut } from "lucide-react";
import GlobalCompanySearch from "./global-company-search";
import SiteNavigation, { type WorkspaceSection } from "./site-navigation";
import { useClerkAuth } from "./clerk-client";

export default function WorkspaceHeader({
  section,
  onNavigate,
}: {
  section: WorkspaceSection;
  onNavigate?: (section: "funds" | "investors" | "watchlist") => void;
}) {
  const { isLoaded, isSignedIn, user, openUserProfile, openSignIn, signOut } = useClerkAuth();

  return (
    <header className="site-header">
      <a className="site-brand" href="/">
        <span className="brand-mark">
          <BarChart3 size={20} />
        </span>
        Smallcap<span className="header-sub">Observatory</span>
      </a>
      <GlobalCompanySearch />
      <div className="header-actions">
        <SiteNavigation section={section} onNavigate={onNavigate} />
        {isLoaded && isSignedIn && user ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              className="quiet-button"
              onClick={openUserProfile}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 8px",
                borderRadius: "6px",
              }}
              title="Manage Account"
            >
              {user.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.fullName || "User"}
                  style={{ width: "22px", height: "22px", borderRadius: "50%" }}
                />
              ) : (
                <User size={16} />
              )}
              <span style={{ fontSize: "0.85rem" }}>
                {user.fullName || user.primaryEmailAddress?.emailAddress?.split("@")[0] || "Account"}
              </span>
            </button>
            <button
              className="quiet-button"
              onClick={signOut}
              title="Sign out"
              style={{ padding: "4px 8px" }}
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button className="quiet-button" onClick={openSignIn}>
              Sign in
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
