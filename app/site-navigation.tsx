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
  PanelLeftClose,
  PanelLeftOpen,
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
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("workspace-nav-collapsed") === "true");
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("workspace-nav-collapsed", String(next));
    } catch {}
  };

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
        if (
          (pending.id === "funds" || pending.id === "investors" || pending.id === "watchlist") &&
          onNavigate
        ) {
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

  const navigation = (compact = false) => (
    <nav aria-label="Main navigation">
      {(
        [
          {
            id: "funds",
            label: "Mutual funds",
            description: "Holdings & portfolio changes",
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
            description: "Leading investor portfolios",
            icon: Users,
          },
          {
            id: "foreign",
            label: "Foreign investors",
            description: "Indian holdings & activity",
            icon: Globe2,
          },
          {
            id: "venture",
            label: "Venture capital",
            description: "Indian-listed pre-IPO investments",
            icon: Sprout,
          },
          {
            id: "sectors",
            label: "Sector funds",
            description: "Energy, auto & FMCG",
            icon: Layers3,
          },
        ] as const
      ).map((item) => (
        <button
          key={item.id}
          title={compact ? item.label : undefined}
          aria-label={item.label}
          className={section === item.id ? "active" : ""}
          aria-current={section === item.id ? "page" : undefined}
          onClick={() => {
            setOpen(false);
            if (item.id !== section) setPending({ id: item.id, label: item.label });
          }}
        >
          <item.icon size={20} />
          <span className="workspace-nav-copy">
            <strong>{item.label}</strong>
            <small>{item.description}</small>
          </span>
        </button>
      ))}
    </nav>
  );

  return (
    <>
      <aside className="workspace-sidebar" data-collapsed={collapsed}>
        <div className="workspace-sidebar-heading">
          <span>RESEARCH</span>
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
        </div>
        {navigation(collapsed)}
        <div className="workspace-sidebar-footer">Smallcap Observatory</div>
      </aside>
      <button
        className="quiet-button menu-button workspace-mobile-menu"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu size={21} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="workspace-mobile-drawer" showCloseButton={false}>
          <header className="workspace-drawer-heading">
            <DialogTitle>Research workspace</DialogTitle>
            <DialogDescription className="sr-only">Choose a research section</DialogDescription>
            <DialogClose aria-label="Close navigation">
              <X size={20} />
            </DialogClose>
          </header>
          {navigation()}
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
