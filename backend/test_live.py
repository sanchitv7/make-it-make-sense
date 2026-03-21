"""
Debug script: tests Gemini Live API with real mic input.
Run: source .venv/bin/activate && python test_live.py
"""
import asyncio
import base64
import json
import os
import sys

from dotenv import load_dotenv

load_dotenv()

API_KEY = os.environ["GEMINI_API_KEY"]
MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"
WS_URL = (
    f"wss://generativelanguage.googleapis.com/ws/"
    f"google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent"
    f"?key={API_KEY}"
)


async def run():
    try:
        import websockets
        import sounddevice as sd
    except ImportError:
        print("Install deps: uv pip install websockets sounddevice")
        sys.exit(1)

    RATE = 16000
    CHUNK = 2048  # ~128ms

    print(f"Connecting to Gemini Live ({MODEL})...")
    async with websockets.connect(WS_URL) as ws:
        # Setup
        await ws.send(json.dumps({
            "setup": {
                "model": f"models/{MODEL}",
                "generationConfig": {"responseModalities": ["AUDIO"]},
                "inputAudioTranscription": {},
                "systemInstruction": {
                    "parts": [{"text": "You are a helpful assistant. Listen carefully and transcribe what the user says."}]
                },
            }
        }))
        resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
        assert "setupComplete" in resp, f"Expected setupComplete, got: {resp}"
        print("✓ Connected. Speak into your mic. Press Ctrl+C to stop.\n")

        # Receive loop
        async def recv_loop():
            async for raw in ws:
                msg = json.loads(raw)
                sc = msg.get("serverContent", {})
                it = sc.get("inputTranscription", {}).get("text")
                ot = sc.get("outputTranscription", {}).get("text")
                if it:
                    print(f"[INPUT]  {it}")
                if ot:
                    print(f"[OUTPUT] {ot}")

        # Send mic audio
        async def send_loop():
            loop = asyncio.get_event_loop()
            q: asyncio.Queue = asyncio.Queue()

            def callback(indata, frames, time, status):
                loop.call_soon_threadsafe(q.put_nowait, indata.copy())

            with sd.InputStream(samplerate=RATE, channels=1, dtype="int16",
                                blocksize=CHUNK, callback=callback):
                while True:
                    chunk = await q.get()
                    b64 = base64.b64encode(chunk.tobytes()).decode()
                    await ws.send(json.dumps({
                        "realtimeInput": {
                            "audio": {"data": b64, "mimeType": "audio/pcm;rate=16000"}
                        }
                    }))

        await asyncio.gather(recv_loop(), send_loop())


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\nStopped.")
