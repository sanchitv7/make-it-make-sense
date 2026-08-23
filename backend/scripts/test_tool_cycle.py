"""
Test script: verifies report_claim tool cycle and manual VAD activity signals.

Uses the Python SDK directly (same path as main.py) and sends a looping
sine-wave audio stream with optional client-side activityStart/activityEnd
boundaries (mirrors browser VAD → backend relay).

Run: source .venv/bin/activate && python scripts/test_tool_cycle.py
"""
import asyncio
import math
import os
import struct
import time

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"
RATE = 16000
CHUNK_SAMPLES = 1024  # ~64ms per chunk — matches frontend PCM chunk size
USE_MANUAL_VAD = True

SYSTEM_INSTRUCTION = (
    "You are a silent background fact-check monitor. "
    "You listen to live audio and ONLY call the report_claim function when you detect a verifiable factual claim. "
    "You do NOT speak, respond, greet, or generate any text output. "
    "You are completely silent — your only action is calling report_claim.\n\n"
    "When you hear a verifiable factual claim, immediately call report_claim with the exact claim text. "
    "Do this as soon as the claim is complete enough to fact-check — do not wait for extended silence.\n\n"
    "NEVER speak or produce any audio or text response. "
    "ONLY action allowed: call report_claim when a verifiable claim is detected."
)


def make_silence_chunk() -> bytes:
    """64ms of silence at 16kHz, 16-bit PCM."""
    return b"\x00\x00" * CHUNK_SAMPLES


def make_tone_chunk(freq: float, t_offset: float) -> bytes:
    """64ms of a sine tone to simulate speech activity."""
    samples = []
    for i in range(CHUNK_SAMPLES):
        t = t_offset + i / RATE
        val = int(math.sin(2 * math.pi * freq * t) * 8000)
        val = max(-32768, min(32767, val))
        samples.append(struct.pack("<h", val))
    return b"".join(samples)


def live_config() -> types.LiveConnectConfig:
    realtime_input_config = None
    if USE_MANUAL_VAD:
        realtime_input_config = types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                disabled=True,
            ),
            activity_handling=types.ActivityHandling.NO_INTERRUPTION,
            turn_coverage=types.TurnCoverage.TURN_INCLUDES_ALL_INPUT,
        )

    return types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction=SYSTEM_INSTRUCTION,
        input_audio_transcription=types.AudioTranscriptionConfig(),
        realtime_input_config=realtime_input_config,
        tools=[
            types.Tool(
                function_declarations=[
                    types.FunctionDeclaration(
                        name="report_claim",
                        description="Report a verifiable factual claim heard in the audio",
                        parameters=types.Schema(
                            type="OBJECT",
                            properties={
                                "claim_text": types.Schema(type="STRING"),
                                "timestamp_seconds": types.Schema(type="INTEGER"),
                            },
                            required=["claim_text", "timestamp_seconds"],
                        ),
                    )
                ]
            )
        ],
    )


async def run():
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    tool_call_count = 0
    tool_response_count = 0
    transcript_chunks = 0
    turn_complete_count = 0
    first_tool_latency: float | None = None
    start = time.time()

    print(f"[{0:.1f}s] Connecting to Gemini Live (manual_vad={USE_MANUAL_VAD})...")

    async with client.aio.live.connect(model=MODEL, config=live_config()) as session:
        print(f"[{time.time() - start:.1f}s] Connected.")

        async def send_audio():
            t_offset = 0.0
            in_speech = False
            while t_offset < 60.0:
                # Alternate ~2s tone / ~1s silence to simulate speech patterns
                should_speak = (int(t_offset) % 3) != 2
                if should_speak and not in_speech:
                    if USE_MANUAL_VAD:
                        await session.send_realtime_input(activity_start=types.ActivityStart())
                        print(f"[{time.time() - start:.1f}s] activityStart")
                    in_speech = True
                elif not should_speak and in_speech:
                    if USE_MANUAL_VAD:
                        await session.send_realtime_input(activity_end=types.ActivityEnd())
                        print(f"[{time.time() - start:.1f}s] activityEnd")
                    in_speech = False

                chunk = (
                    make_tone_chunk(440.0, t_offset)
                    if should_speak
                    else make_silence_chunk()
                )
                await session.send_realtime_input(
                    audio=types.Blob(data=chunk, mime_type="audio/pcm;rate=16000")
                )
                t_offset += CHUNK_SAMPLES / RATE
                await asyncio.sleep(CHUNK_SAMPLES / RATE)

            if USE_MANUAL_VAD and in_speech:
                await session.send_realtime_input(activity_end=types.ActivityEnd())
                print(f"[{time.time() - start:.1f}s] activityEnd (final)")

            print(f"[{time.time() - start:.1f}s] Audio send complete.")

        async def recv_messages():
            nonlocal tool_call_count, tool_response_count, transcript_chunks
            nonlocal turn_complete_count, first_tool_latency
            while True:
                try:
                    response = await session._receive()
                except Exception as e:
                    print(f"[{time.time() - start:.1f}s] _receive() error: {e}")
                    break

                sc = response.server_content
                if sc:
                    it = sc.input_transcription
                    if it and it.text:
                        transcript_chunks += 1
                        print(
                            f"[{time.time() - start:.1f}s] TRANSCRIPT #{transcript_chunks}: {it.text!r}"
                        )
                    if sc.turn_complete:
                        turn_complete_count += 1
                        print(f"[{time.time() - start:.1f}s] turnComplete #{turn_complete_count}")

                tc = response.tool_call
                if tc and tc.function_calls:
                    for fc in tc.function_calls:
                        tool_call_count += 1
                        if first_tool_latency is None:
                            first_tool_latency = time.time() - start
                        print(
                            f"[{time.time() - start:.1f}s] TOOL CALL #{tool_call_count}: "
                            f"id={fc.id!r} name={fc.name} args={fc.args}"
                        )
                        try:
                            await session.send_tool_response(
                                function_responses=[
                                    types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"status": "ok"},
                                    )
                                ]
                            )
                            tool_response_count += 1
                            print(
                                f"[{time.time() - start:.1f}s] tool_response sent "
                                f"(total sent: {tool_response_count})"
                            )
                        except Exception as e:
                            print(f"[{time.time() - start:.1f}s] ERROR sending tool_response: {e}")

                go_away = response.go_away
                if go_away:
                    print(f"[{time.time() - start:.1f}s] GoAway: time_left={go_away.time_left}")

        await asyncio.gather(send_audio(), recv_messages())

    print(
        f"\nDone. tool_calls={tool_call_count} tool_responses={tool_response_count} "
        f"transcript_chunks={transcript_chunks} turn_complete={turn_complete_count} "
        f"first_tool_latency_s={first_tool_latency}"
    )


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\nStopped.")
