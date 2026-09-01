# Frontend

Next.js 14 app (App Router). Source in `src/`:
- `app/` — routes: `/` (home), `/session/[id]`, `/summary/[id]`, `/sessions`, `/auth/callback`, `/auth/reset`
- `components/` — UI components (verdict-feed, top-bar, auth-modal, etc.)
- `hooks/` — `use-live-session.ts`
- `lib/` — LiveSession, ListenPreflight, claim-machine, hear-sentences, trial/auth helpers
- `types/` — shared TypeScript types plus `claim.ts`

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
