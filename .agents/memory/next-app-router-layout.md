---
name: Next App Router alongside the generated scaffold
description: Preserve a compatible route-tree layout when adopting Next.js in a generated web artifact.
---

When using Next.js App Router in the generated web artifact, place the app routes under `src/app` beside the scaffold's `src/pages`. Remove any leftover root-level `app/` directory, even if it is empty; Next can treat it as a second route root and reject the mixed layout.

**Why:** Next.js 16 rejected the initial setup because the generated Pages Router lived under `src/pages` while an empty App Router directory remained at the project root.

**How to apply:** Before starting Next.js, check for both root-level and `src/` route folders and ensure the App and Pages Router trees share one parent directory.
