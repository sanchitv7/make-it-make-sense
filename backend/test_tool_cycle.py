"""
Test script: verifies report_claim tool cycle doesn't stop after N calls.

Uses the Python SDK directly (same path as main.py) and sends a looping
sine-wave audio stream. Watch the output to see if transcription/tool calls
stop after 3 detections.

Run: source .venv/bin/activate && python test_tool_cycle.py
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
CHUNK_SAMPLES = 2048  # ~128ms per chunk

SYSTEM_INSTRUCTION = (
    "You are a silent background fact-check monitor. "
    "You listen to live audio and ONLY call the report_claim function when you detect a verifiable factual claim. "
    "You do NOT speak, respond, greet, or generate any text output. "
    "You are completely silent — your only action is calling report_claim.\n\n"
    "NEVER speak or produce any audio or text response. "
    "ONLY action allowed: call report_claim when a verifiable claim is detected."
)

# A short speech clip encoded as repeated sine tones (placeholder).
# In practice, pipe real audio. We'll send silence here to test session health.
def make_silence_chunk() -> bytes:
    """128ms of silence at 16kHz, 16-bit PCM."""
    return b'\x00\x00' * CHUNK_SAMPLES


def make_tone_chunk(freq: float, t_offset: float) -> bytes:
    """128ms of a sine tone to simulate speech activity."""
    samples = []
    for i in range(CHUNK_SAMPLES):
        t = t_offset + i / RATE
        val = int(math.sin(2 * math.pi * freq * t) * 8000)
        val = max(-32768, min(32767, val))
        samples.append(struct.pack('<h', val))
    return b''.join(samples)


async def run():
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction=SYSTEM_INSTRUCTION,
        input_audio_transcription=types.AudioTranscriptionConfig(),
        tools=[types.Tool(function_declarations=[
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
        ])],
    )

    tool_call_count = 0
    tool_response_count = 0
    transcript_chunks = 0
    start = time.time()

    print(f"[{0:.1f}s] Connecting to Gemini Live...")

    async with client.aio.live.connect(model=MODEL, config=config) as session:
        print(f"[{time.time()-start:.1f}s] Connected.")

        async def send_audio():
            """Send ~30s of audio then stop."""
            t_offset = 0.0
            chunks_sent = 0
            while t_offset < 60.0:
                # Alternate 2s tone / 1s silence to simulate speech patterns
                in_speech = (int(t_offset) % 3) != 2
                if in_speech:
                    chunk = make_tone_chunk(440.0, t_offset)
                else:
                    chunk = make_silence_chunk()
                await session.send_realtime_input(
                    audio=types.Blob(data=chunk, mime_type="audio/pcm;rate=16000")
                )
                t_offset += CHUNK_SAMPLES / RATE
                chunks_sent += 1
                await asyncio.sleep(CHUNK_SAMPLES / RATE)  # real-time pacing
            print(f"[{time.time()-start:.1f}s] Audio send complete.")

        async def recv_messages():
            nonlocal tool_call_count, tool_response_count, transcript_chunks
            while True:
                try:
                    response = await session._receive()
                except Exception as e:
                    print(f"[{time.time()-start:.1f}s] _receive() error: {e}")
                    break

                sc = response.server_content
                if sc:
                    it = sc.input_transcription
                    if it and it.text:
                        transcript_chunks += 1
                        print(f"[{time.time()-start:.1f}s] TRANSCRIPT #{transcript_chunks}: {it.text!r}")
                    if sc.turn_complete:
                        print(f"[{time.time()-start:.1f}s] turnComplete")
                    if sc.generation_complete:
                        print(f"[{time.time()-start:.1f}s] generationComplete")

                tc = response.tool_call
                if tc and tc.function_calls:
                    for fc in tc.function_calls:
                        tool_call_count += 1
                        print(f"[{time.time()-start:.1f}s] TOOL CALL #{tool_call_count}: id={fc.id!r} name={fc.name} args={fc.args}")
                        # Respond immediately, same as main.py
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
                            print(f"[{time.time()-start:.1f}s] tool_response sent (total sent: {tool_response_count})")
                        except Exception as e:
                            print(f"[{time.time()-start:.1f}s] ERROR sending tool_response: {e}")

                go_away = response.go_away
                if go_away:
                    print(f"[{time.time()-start:.1f}s] GoAway: time_left={go_away.time_left}")

        await asyncio.gather(send_audio(), recv_messages())

    print(f"\nDone. tool_calls={tool_call_count} tool_responses={tool_response_count} transcript_chunks={transcript_chunks}")


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\nStopped.")
