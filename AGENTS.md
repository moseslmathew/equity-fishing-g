# Workspace Rules

## Git Remote Rules
Whenever performing any Git-related action in this repository:
1. **Pull / Fetch**:
   - Must ALWAYS come from `https://github.com/moseslmathew/equity-fishing.git`
2. **Push**:
   - Must ALWAYS go to `https://github.com/moseslmathew/equity-fishing-g.git`

## Repository Feature Isolation & Merge Policy
1. **Feature Separation**:
   - **`equity-fishing-g`** (this repo): Features multi-user authentication via **Clerk**, user profiles, watchlists, and user-specific data persistence.
   - **`equity-fishing`** (upstream): Retains the legacy single fixed-password login.
2. **Merge Protection**:
   - When pulling/merging upstream updates from `https://github.com/moseslmathew/equity-fishing.git`:
     - **PROTECT G-REPO FEATURES**: All changes made for `equity-fishing-g` (Clerk auth integration, user watchlists, user-specific API routes, user DB models) MUST remain intact.
     - Never revert Clerk authentication or user watchlist features back to the upstream single-password code.
     - Only upstream data updates (fund disclosures, holdings, volume history, upstream bug fixes) should be accepted and merged.
