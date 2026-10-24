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
     - Never overwrite, regress, or revert **`$user specific`** or user login features back to upstream code.
     - Only upstream data updates (fund disclosures, holdings, volume history, upstream bug fixes) should be accepted and merged.
