# Workspace Rules

## Git Remote Rules
Whenever performing any Git-related action in this repository:
1. **Pull / Fetch**:
   - Must ALWAYS come from `https://github.com/moseslmathew/equity-fishing.git`
2. **Push**:
   - Must ALWAYS go to `https://github.com/moseslmathew/equity-fishing-g.git`

## Repository Feature Isolation & Merge Policy
1. **Feature Separation**:
   - **`equity-fishing-g`** (this repo / push target): Features multi-user authentication via **Clerk**, user profiles, watchlists, user-specific data persistence, and any features designated with **`$user specific`**.
   - **`equity-fishing`** (upstream / pull source): Retains the legacy single fixed-password login and upstream data updates.
2. **`$user specific` Features**:
   - Any feature or task labeled with **`$user specific`** is exclusive to user login / user-scoped functionality and belongs **strictly to the push repository (`equity-fishing-g`)**.
3. **Merge Protection**:
   - When pulling/merging upstream updates from `https://github.com/moseslmathew/equity-fishing.git`:
     - **PROTECT G-REPO & `$user specific` FEATURES**: All changes made for `equity-fishing-g` (Clerk auth integration, user watchlists, user-specific API routes, user DB models, and any **`$user specific`** features) MUST remain intact.
     - **PROTECT CUSTOM BRAND ICON / FAVICON**: Never overwrite or revert `public/favicon.svg`, `components/brand-logo.tsx`, `metadata.icons` in `app/layout.tsx`, or `.brand-mark` / `<BrandLogo />` in `app/workspace-header.tsx` and `app/login.tsx` from upstream pulls.
     - **PROTECT CUSTOM AI INSIGHTS & PDF EXPORT**: Unless explicitly instructed otherwise, do NOT overwrite custom AI Insights / 3-month forensic report & Print-to-PDF files (`app/agent-research.tsx`, `app/research-newsletter.tsx`, `lib/agent-research.ts`, `lib/monthly-letter.ts`, `lib/forensic-analysis.ts`, `data/agent-research.json`, `data/forensic-nse-3m.json`, or `@media print` styles in `app/globals.css`) from upstream pulls.
     - **PROTECT VERCEL / NEON DEPLOYMENT CONFIG**: Keep `scripts/run-framework.mjs`, `next.config.ts`, `lib/cloudflare-workers-shim.ts`, Neon DB compatibility, `process.env` merge in `lib/access.ts`, and optional R2 `BUCKET` handling in API routes intact.
     - Never overwrite, regress, or revert **`$user specific`** or user login features back to upstream code.
     - Only upstream data updates (fund disclosures, holdings, volume history, foreign/venture data, upstream bug fixes) should be accepted and merged.
