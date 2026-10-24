"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Menu,
  BarChart3,
  Bookmark,
  Users,
  Layers3,
  Globe2,
  Sprout,
  ArrowRight,
  Check,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";

export type WorkspaceSection =
  | "funds"
  | "investors"
  | "foreign"
  | "sectors"
  | "venture"
  | "watchlist";

export default function SiteNavigation({
  section,
  onNavigate,
}: {
  section: WorkspaceSection;
  onNavigate?: (section: "funds" | "investors" | "watchlist") => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<{ id: WorkspaceSection; label: string } | null>(null);

  useEffect(() => {
    const restore = () => setPending(null);
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  useEffect(() => {
    if (!pending) return;
    let nextFrame = 0;
    // Commit and paint the loading screen before starting a document navigation.
    const frame = requestAnimationFrame(() => {
      nextFrame = requestAnimationFrame(() => {
        if ((pending.id === "funds" || pending.id === "investors" || pending.id === "watchlist") && onNavigate) {
          onNavigate(pending.id);
          setPending(null);
          return;
        }
        const url =
          pending.id === "foreign"
            ? "/foreign-investors"
            : pending.id === "venture"
            ? "/venture-capital"
            : pending.id === "sectors"
            ? "/sectors"
            : pending.id === "watchlist"
            ? "/#watchlist"
            : pending.id === "investors"
            ? "/#investors"
            : "/";
        window.location.assign(url);
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(nextFrame);
    };
  }, [pending, onNavigate]);

  return (
    <>
      <button
        className="quiet-button menu-button"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu size={21} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="site-menu" showCloseButton={false}>
          <header className="workspace-menu-header">
            <span className="workspace-menu-eyebrow">YOUR RESEARCH WORKSPACE</span>
            <DialogTitle>Explore</DialogTitle>
            <DialogDescription>Where would you like to go?</DialogDescription>
            <DialogClose className="workspace-menu-close" aria-label="Close navigation">
              <X size={19} />
            </DialogClose>
          </header>
          <nav aria-label="Main navigation">
            {(
              [
                {
                  id: "funds",
                  label: "Mutual funds",
                  description: "Equity holdings, portfolio changes & research",
                  icon: BarChart3,
                },
                {
                  id: "watchlist",
                  label: "My Watchlist",
                  description: "Personal pinned stocks, mutual funds & notes",
                  icon: Bookmark,
                },
                {
                  id: "investors",
                  label: "Ace investors",
                  description: "Explore leading investors’ portfolios",
                  icon: Users,
                },
                {
                  id: "foreign",
                  label: "Foreign investors",
                  description: "Indian exposure, disclosed holdings & activity",
                  icon: Globe2,
                },
                {
                  id: "venture",
                  label: "Venture capital focused equity",
                  description: "Indian-listed companies backed before IPO",
                  icon: Sprout,
                },
                {
                  id: "sectors",
                  label: "Sector funds",
                  description: "Energy, Auto & FMCG",
                  icon: Layers3,
                },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                className={section === item.id ? "active" : ""}
                aria-current={section === item.id ? "page" : undefined}
                onClick={() => {
                  setOpen(false);
                  if (item.id !== section) setPending({ id: item.id, label: item.label });
                }}
              >
                <span className="workspace-menu-icon">
                  <item.icon size={22} />
                </span>
                <span className="workspace-menu-copy">
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </span>
                <span className="workspace-menu-direction" aria-hidden="true">
                  {section === item.id ? <Check size={18} /> : <ArrowRight size={18} />}
                </span>
              </button>
            ))}
          </nav>
        </DialogContent>
      </Dialog>
      {pending &&
        createPortal(
          <div className="navigation-loading-screen" role="status" aria-live="polite">
            <span className="loading-spinner" aria-hidden="true" />
            <h1>Loading {pending.label}…</h1>
            <p>Opening your research workspace</p>
          </div>,
          document.body
        )}
    </>
  );
}
