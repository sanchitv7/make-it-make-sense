# Supabase Auth for Accounts

Listening requires a signed-in Account. We use Supabase Auth (email/password) on the Next.js app and verify access tokens on FastAPI via the Auth API (`get_user`) with the service-role client — covering session HTTP, fact-check, and `/ws/live` — rather than a separate identity vendor, a frontend-only gate, or local JWT-secret verification. Sessions store `user_id` so ownership is real now and a past-sessions UI can follow without re-modeling identity.
