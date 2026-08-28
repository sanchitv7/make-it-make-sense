# Anonymous 30-second listening trial

The first Begin does not ask for an email. The app silently creates a Supabase **Anonymous Account** (`signInAnonymously`), which is a real Auth user with a JWT and `is_anonymous` claim. Listening, fact-check, and `/ws/live` stay JWT-gated. That Account may create **one** Session; the Live socket and the session page end it after **30 seconds** of wall-clock time from `started_at`. The guest still sees The Verdict. A second Begin (or New Session) opens the create-account modal. `updateUser({ email, password, data: { full_name } })` converts the same Auth user so the trial Session remains in Past Sessions.

We chose anonymous Auth over an unsigned guest token so ownership, conversion, and the existing service-role API stay the same model. Frontend chrome treats anonymous users as guests (no AccountChip, Sessions, or copy-link). Permanent Accounts have no duration cap.

Requires dashboard: **Anonymous sign-ins** enabled, **Manual linking** enabled (for conversion), and Confirm email off for v1 as already documented.

Supersedes the “listening requires a signed-in (email) Account” sentence in [0001-supabase-auth.md](0001-supabase-auth.md). Listening still requires a JWT; a permanent Account is required for a second Session and unlimited duration.
