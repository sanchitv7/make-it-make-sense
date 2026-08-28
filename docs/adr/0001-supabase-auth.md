# Supabase Auth for Accounts

Listening requires a JWT from a Supabase Auth user. Permanent Accounts use email/password on the Next.js app. FastAPI verifies access tokens via the Auth API (`get_user`) with the service-role client — covering session HTTP, fact-check, and `/ws/live` — rather than a separate identity vendor, a frontend-only gate, or local JWT-secret verification. Sessions store `user_id` so ownership is real.

The first listening run can use an Anonymous Account (no email). See [0003-anonymous-trial.md](0003-anonymous-trial.md).
