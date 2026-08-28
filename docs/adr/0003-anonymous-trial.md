# Anonymous one-minute listening trial

The first Begin does not ask for an email. The app silently creates a Supabase **Anonymous Account** (`signInAnonymously`), which is a real Auth user with a JWT and `is_anonymous` claim. Listening, fact-check, and `/ws/live` stay JWT-gated. That Account may create **one** Session; the Live socket and the session page end it after **60 seconds** of wall-clock time from `started_at`. The guest still sees The Verdict. The live UI shows the normal elapsed timer (count up), not a countdown.

The Anonymous Account JWT persists in the browser. A later visit is still that Account, so the preview cannot be repeated. Home does not keep saying Begin: it states that this device already used the preview, offers the last verdict when one exists, and opens a create-account modal that does not assume they remember the Session. The Verdict still says “Keep this session,” because they just finished listening. Conversion uses `updateUser({ email, data: { full_name } })` so the same Auth user keeps the trial Session. Confirm email is on: the user stays anonymous until they open the confirmation link; the password is applied after that (GoTrue requires a verified email before an anonymous user can set a password).

We chose anonymous Auth over an unsigned guest token so ownership, conversion, and the existing service-role API stay the same model. Frontend chrome treats anonymous users as guests (no AccountChip, Sessions, or copy-link). Permanent Accounts have no duration cap.

Requires dashboard: **Anonymous sign-ins** enabled, **Manual linking** enabled (for conversion), and **Confirm email** on. Redirect allow list must include `/auth/callback` and `/auth/reset`.

Supersedes the “listening requires a signed-in (email) Account” sentence in [0001-supabase-auth.md](0001-supabase-auth.md). Listening still requires a JWT; a permanent Account is required for a second Session and unlimited duration.
