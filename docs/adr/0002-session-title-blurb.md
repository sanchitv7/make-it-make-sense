# One-shot Session title and blurb

When a listening Session ends with at least one Claim, we generate a short title and 1–2 line blurb once via `gemini-3.1-flash-lite`, persist them on the Session row, and serve them to the verdict page and Past Sessions board. Generation runs in a FastAPI background task so ending a Session stays non-blocking; missing fields are omitted in the UI rather than shown as errors or placeholders. We chose a cheap Flash-Lite model over reusing fact-check `gemini-2.5-flash` because this copy does not need search grounding.
