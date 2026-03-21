"""
Test claim detection AND verification end-to-end.

Detection: sends a pre-written transcript to Gemini Live via text input (no mic needed)
           and collects report_claim() tool calls.

Verification: runs each detected claim through fact_check_claim() and prints verdicts.

Usage: uv run python test_claims.py [preset]
       uv run python test_claims.py political

Exit codes: 0 = at least one claim detected and verified (non-UNVERIFIED), 1 = failure
"""
import asyncio
import json
import os
import sys

from dotenv import load_dotenv

load_dotenv()

from fact_check import fact_check_claim
from models import Verdict
from prompts import PROMPTS

API_KEY = os.environ["GEMINI_API_KEY"]
MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"
WS_URL = (
    "wss://generativelanguage.googleapis.com/ws/"
    "google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent"
    f"?key={API_KEY}"
)

TRANSCRIPTS = {
    "political": """
        Good evening. The United States has the highest incarceration rate in the world,
        with over 2.3 million people behind bars. Since the 1994 Crime Bill was signed by
        President Clinton, violent crime has actually dropped by 50 percent nationwide.
        Our GDP grew by 6.4 percent last quarter, the fastest growth since 1984.
        Meanwhile, the top 1 percent of earners now control more wealth than the bottom
        90 percent combined. Abraham Lincoln, our 16th president, abolished slavery
        with the Emancipation Proclamation in 1862. We spend more on defense than the
        next 10 countries combined — over 800 billion dollars annually.
    """,
    "podcast": """
        So fascinating — did you know the Great Wall of China is actually NOT visible
        from space with the naked eye? That's a total myth. And speaking of myths,
        humans only use 10 percent of their brains — completely false, we use virtually
        all of it. Coffee is actually the second most traded commodity in the world after
        oil. Mount Everest is the tallest mountain on Earth at 8,849 meters above sea level.
        The average person swallows 8 spiders a year in their sleep — that one's also false
        by the way. Lightning never strikes the same place twice? Wrong — the Empire State
        Building gets struck about 25 times per year.
    """,
    "earnings": """
        We delivered another record quarter with revenue of 94.3 billion dollars,
        up 23 percent year over year. Our cloud segment grew 41 percent to reach
        28 billion in ARR. We now have 2.1 billion monthly active users globally.
        Operating margins expanded to 38 percent, up from 31 percent a year ago.
        We've returned 15 billion dollars to shareholders through buybacks this year alone.
        Our market share in enterprise software reached 34 percent, up from 28 percent.
    """,
    "news": """
        Breaking news tonight: the unemployment rate has fallen to 3.4 percent,
        the lowest since 1969. The Federal Reserve raised interest rates by 25 basis
        points today, the 11th increase in 18 months. Officials confirmed that the
        earthquake measuring 7.8 on the Richter scale struck at 3:42 AM local time,
        killing at least 340 people. The President signed the infrastructure bill into
        law yesterday, allocating 1.2 trillion dollars over 10 years. Inflation rose
        to 4.1 percent last month, up from 3.7 percent in October.
    """,
}


VERDICT_EMOJI = {
    Verdict.TRUE: "✅ TRUE",
    Verdict.FALSE: "❌ FALSE",
    Verdict.MISLEADING: "⚠️  MISLEADING",
    Verdict.UNVERIFIED: "❓ UNVERIFIED",
}


async def detect_claims(preset: str) -> list[tuple[str, int]]:
    """Phase 1: stream transcript to Gemini Live and collect (claim_text, timestamp) pairs."""
    transcript = TRANSCRIPTS.get(preset, TRANSCRIPTS["podcast"])
    system_instruction = PROMPTS[preset]

    import websockets

    print(f"Connecting to Gemini Live ({MODEL})...")

    async with websockets.connect(WS_URL) as ws:
        await ws.send(json.dumps({
            "setup": {
                "model": f"models/{MODEL}",
                "generationConfig": {"responseModalities": ["AUDIO"]},
                "inputAudioTranscription": {},
                "systemInstruction": {"parts": [{"text": system_instruction}]},
                "tools": [{
                    "functionDeclarations": [{
                        "name": "report_claim",
                        "description": "Report a verifiable factual claim heard in the audio",
                        "parameters": {
                            "type": "OBJECT",
                            "properties": {
                                "claim_text": {"type": "STRING"},
                                "timestamp_seconds": {"type": "INTEGER"},
                            },
                            "required": ["claim_text", "timestamp_seconds"],
                        },
                    }]
                }],
            }
        }))

        resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=15))
        assert "setupComplete" in resp, f"Unexpected: {resp}"
        print("✓ Connected\n")

        print("Transcript being analyzed:")
        print("-" * 60)
        print(transcript.strip())
        print("-" * 60)
        print("\n[Phase 1] Detecting claims...\n")

        await ws.send(json.dumps({
            "clientContent": {
                "turns": [{"role": "user", "parts": [{"text": transcript.strip()}]}],
                "turnComplete": True,
            }
        }))

        detected: list[tuple[str, int]] = []
        try:
            async with asyncio.timeout(30):
                async for raw in ws:
                    msg = json.loads(raw)

                    if "toolCall" in msg:
                        for call in msg["toolCall"].get("functionCalls", []):
                            if call["name"] == "report_claim":
                                claim = call["args"].get("claim_text", "")
                                ts = call["args"].get("timestamp_seconds", 0)
                                detected.append((claim, ts))
                                print(f"  [{ts}s] {claim}")

                                await ws.send(json.dumps({
                                    "toolResponse": {
                                        "functionResponses": [{
                                            "id": call["id"],
                                            "name": call["name"],
                                            "response": {"status": "ok"},
                                        }]
                                    }
                                }))

                    if msg.get("serverContent", {}).get("turnComplete"):
                        break

        except asyncio.TimeoutError:
            pass

        return detected


async def verify_claims(
    detected: list[tuple[str, int]], preset: str
) -> list[dict]:
    """Phase 2: fact-check each detected claim concurrently."""
    print(f"\n[Phase 2] Verifying {len(detected)} claim(s) via Gemini + Google Search...\n")

    async def check(claim_text: str, ts: int) -> dict:
        result = await fact_check_claim(claim_text=claim_text, preset=preset)
        return {
            "claim_text": claim_text,
            "timestamp_seconds": ts,
            "verdict": result.verdict,
            "verdict_summary": result.verdict_summary,
            "source_name": result.source_name,
            "source_url": result.source_url,
        }

    results = await asyncio.gather(*(check(c, t) for c, t in detected))
    return list(results)


async def run(preset: str) -> bool:
    """Returns True if detection + verification both succeed."""
    print(f"Preset: {preset}\n")

    # Phase 1 — detection
    detected = await detect_claims(preset)

    print(f"\n{'─' * 60}")
    print(f"Detection: {len(detected)} claim(s) found")

    if not detected:
        print("\n✗ FAIL — no claims detected. Check Gemini Live connection and prompt.")
        return False

    # Phase 2 — verification
    results = await verify_claims(detected, preset)

    print(f"{'─' * 60}")
    print("Verification results:\n")

    verified_count = 0
    for r in results:
        label = VERDICT_EMOJI[r["verdict"]]
        print(f"  {label}")
        print(f"  Claim:   {r['claim_text']}")
        print(f"  Summary: {r['verdict_summary']}")
        if r["source_url"]:
            print(f"  Source:  {r['source_name']} — {r['source_url']}")
        print()
        if r["verdict"] != Verdict.UNVERIFIED:
            verified_count += 1

    print(f"{'─' * 60}")
    print(f"Total detected:  {len(detected)}")
    print(f"Total verified:  {verified_count} / {len(results)} (non-UNVERIFIED)")

    if verified_count == 0:
        print("\n✗ FAIL — all claims came back UNVERIFIED (no trusted source found).")
        return False

    print("\n✓ PASS — detection and verification working correctly.")
    return True


if __name__ == "__main__":
    preset = sys.argv[1] if len(sys.argv) > 1 else "political"
    if preset not in TRANSCRIPTS:
        print(f"Unknown preset '{preset}'. Choose from: {', '.join(TRANSCRIPTS)}")
        sys.exit(1)
    ok = asyncio.run(run(preset))
    sys.exit(0 if ok else 1)
