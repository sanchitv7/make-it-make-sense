# Rubric. Faster listen and claim cards

Score each candidate 0–3 per criterion. 0 is fail. 3 is fully meets. Recommend one base. Name grafts from the losers.

## Criteria

1. **Start on the click.** Mic permission runs in the BEGIN LISTENING click, not a later `useEffect`. Trial `started_at` does not start if the mic is denied. Handshake overlaps instead of POST → navigate → GET → mic → WS → Gemini → Silero in a line. Honest connecting vs listening chrome.

2. **Cards at sentence time.** Three rapid claim-sentences become three staggered cards in a checking/phasing state while `/api/fact-check` still runs. The user asked for this specifically. A design that still waits on Gemini `report_claim` after a whole breath scores at most 1 here, even if turns cut sooner.

3. **Typed Claim lifecycle.** One id-keyed record. Discriminated phase. No `claims` + `checkingIds` + `verdicts` join on `claim_text`. Illegal combinations do not compile.

4. **Protocol honesty.** Silero remains the only VAD. Native-audio `tool_response` is immediate `{status:ok}`. Fact-check is not on that loop. No `beginListening` empty-turn. No server-VAD. PCM before first `activity_start` is handled.

5. **Small public surface.** Session page does not orchestrate WS, VAD, or tool acks. Prefer a deep module over a connect kit. Reject shallow pass-throughs, wire types on the page, and temporal load/validate/save folders.

6. **Idempotent listen.** Duplicate `report_claim` text, reconnect, Strict Mode remount, and failed search converge. Warmup across navigate does not leak a second mic.

## Paths

- A. `.arena/faster-claims/candidate-a/` Claim lifecycle, heard from transcript
- B. `.arena/faster-claims/candidate-b/` Gemini-only, TurnCutter on sentences
- C. `.arena/faster-claims/candidate-c/` ListenPreflight, Gemini-only detector

Also read `.arena/faster-claims/GROUNDING.md` and `HOW.md`.
