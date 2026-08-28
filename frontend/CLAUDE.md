# Frontend

Next.js 14 app (App Router). Source in `src/`:
- `app/` — routes: `/` (home), `/session/[id]`, `/summary/[id]`, `/sessions`
- `components/` — UI components (verdict-feed, top-bar, auth-modal, etc.)
- `hooks/` — `use-gemini-live.ts`, `use-fact-check.ts`
- `lib/` — pure helpers (`trial.ts`, `account-kind.ts`, `claim-dedupe.ts`)
- `types/` — shared TypeScript types

```bash
npm run dev         # http://localhost:3000
npm run build
npm run lint
npm run typecheck
npm run test        # vitest
npm run format
```

From repo root, prefer `make check` before push.

Env: `frontend/.env.local` needs `NEXT_PUBLIC_BACKEND_URL=http://localhost:8000`
