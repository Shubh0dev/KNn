# KashiNagri

A Varanasi discovery guide for exploring places to stay, food, local areas, culture, transport and itinerary inspiration.

## Run & Operate

- `pnpm --filter @workspace/kashi-nagri run dev` — run the KashiNagri website
- `pnpm --filter @workspace/kashi-nagri run build` — build the static website export
- `pnpm --filter @workspace/kashi-nagri run typecheck` — typecheck the website
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Website: Next.js App Router, React, TypeScript, Tailwind CSS, Lucide icons
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/kashi-nagri/src/app/` — App Router pages and shared metadata
- `artifacts/kashi-nagri/src/App.tsx` — responsive site UI and client-side interactions
- `artifacts/kashi-nagri/src/data.ts` — illustrative discovery content and types
- `artifacts/kashi-nagri/src/index.css` — site theme and responsive styling

## Architecture decisions

- The first release is a frontend-only discovery experience; mock content is labeled illustrative and is not verified inventory.
- Static export keeps the homepage, Explore and trip preview available without a backend; booking, accounts and itinerary editing are intentionally deferred.

## Product

KashiNagri helps visitors discover Varanasi neighborhoods, stays, food, spiritual services, guides, shopping, local transport, events and trip ideas. The complete itinerary builder is planned for a later part.

## User preferences

- Keep future work aligned with the four-part KashiNagri build brief; implement only the current part's scope.

## Gotchas

- The generated Vite scaffold contains `src/pages`; Next App Router routes must remain alongside it in `src/app`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
