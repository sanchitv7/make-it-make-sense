# Frontend

Next.js 14 app (App Router). Source in `src/`:
- `app/` — routes: `/` (home), `/session/[id]`, `/summary/[id]`
- `components/` — UI components (verdict-feed, top-bar, etc.)
- `hooks/` — `use-gemini-live.ts`, `use-fact-check.ts`
- `types/` — shared TypeScript types

```bash
npm run dev    # http://localhost:3000
npm run build
npm run lint
```

Env: `frontend/.env.local` needs `NEXT_PUBLIC_BACKEND_URL=http://localhost:8000`
