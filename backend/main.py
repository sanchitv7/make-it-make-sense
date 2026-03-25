import asyncio
import base64
import json
import logging
import os

from fastapi import FastAPI, HTTPException, WebSocket, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.websockets import WebSocketDisconnect
from dotenv import load_dotenv
from google import genai
from google.genai import types

from fact_check import fact_check_claim, init_pool
from models import (
    FactCheckRequest,
    FactCheckResponse,
    CreateSessionRequest,
    CreateSessionResponse,
    SessionDetail,
)
from prompts import PROMPTS
import supabase_client

load_dotenv()

logger = logging.getLogger(__name__)
GEMINI_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"

app = FastAPI(title="Make It Make Sense", version="0.1.0")

_cors_origins = ["http://localhost:3000"]
if _extra := os.environ.get("ALLOWED_ORIGINS"):
    _cors_origins.extend(o.strip() for o in _extra.split(",") if o.strip())

@app.on_event("startup")
async def startup():
    await init_pool()


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"name": "Make It Make Sense API", "status": "ok", "version": "0.1.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}


def _to_browser_msg(response) -> dict | None:
    if response.setup_complete is not None:
        return {"setupComplete": {}}
    if response.server_content is not None:
        sc = response.server_content
        sc_dict = {}
        if sc.input_transcription:
            sc_dict["inputTranscription"] = {"text": sc.input_transcription.text}
        if sc.turn_complete:
            sc_dict["turnComplete"] = True
        return {"serverContent": sc_dict} if sc_dict else None
    if response.tool_call is not None:
        calls = [{"id": fc.id, "name": fc.name, "args": fc.args}
                 for fc in (response.tool_call.function_calls or [])]
        return {"toolCall": {"functionCalls": calls}}
    return None


@app.websocket("/ws/live")
async def live_ws(websocket: WebSocket, preset: str = Query(default="podcast")):
    await websocket.accept()
    system_instruction = PROMPTS.get(preset, PROMPTS["podcast"])
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction=system_instruction,
        input_audio_transcription=types.AudioTranscriptionConfig(),
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_HIGH,
                silence_duration_ms=200,
            ),
            turn_coverage=types.TurnCoverage.TURN_INCLUDES_ALL_INPUT,
        ),
        context_window_compression=types.ContextWindowCompressionConfig(
            sliding_window=types.SlidingWindow(),
        ),
        tools=[types.Tool(function_declarations=[
            types.FunctionDeclaration(
                name="report_claim",
                description="Report a verifiable factual claim heard in the audio",
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "claim_text": types.Schema(type="STRING", description="The claim verbatim"),
                        "timestamp_seconds": types.Schema(type="INTEGER", description="Seconds since session start"),
                        "context": types.Schema(type="STRING", description="1-2 surrounding sentences providing context for the claim (who is speaking, what they were discussing)"),
                    },
                    required=["claim_text", "timestamp_seconds"],
                ),
            )
        ])],
    )

    try:
        async with client.aio.live.connect(model=GEMINI_MODEL, config=config) as session:
            # SDK already consumed setupComplete internally during connect()
            await websocket.send_text(json.dumps({"setupComplete": {}}))

            async def browser_to_gemini():
                try:
                    while True:
                        data = json.loads(await websocket.receive_text())
                        if data.get("type") == "audio":
                            await session.send_realtime_input(
                                audio=types.Blob(
                                    data=base64.b64decode(data["data"]),
                                    mime_type="audio/pcm;rate=16000",
                                )
                            )
                        elif data.get("type") == "tool_response":
                            responses = [
                                types.FunctionResponse(id=fr["id"], name=fr["name"], response=fr["response"])
                                for fr in data.get("functionResponses", []) if fr.get("id")
                            ]
                            if responses:
                                await session.send_tool_response(function_responses=responses)
                        elif data.get("type") == "stop":
                            break
                except Exception as e:
                    logger.info("Browser-to-Gemini ended: %s", e)

            async def gemini_to_browser():
                try:
                    while True:
                        response = await session._receive()
                        msg = _to_browser_msg(response)
                        if msg is not None:
                            await websocket.send_text(json.dumps(msg))
                except Exception as e:
                    logger.info("Gemini-to-browser ended: %s", e)

            await asyncio.gather(browser_to_gemini(), gemini_to_browser())

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error("Live WS error: %s", e)
        try:
            await websocket.close(1011, str(e))
        except Exception:
            pass


@app.post("/api/fact-check", response_model=FactCheckResponse)
async def check_fact(request: FactCheckRequest):
    try:
        result = await fact_check_claim(
            claim_text=request.claim_text,
            preset=request.preset,
            speaker_info=request.speaker_info,
            claim_context=request.claim_context,
        )
        result.timestamp_seconds = request.timestamp_seconds

        try:
            supabase_client.upsert_claim(
                {
                    "session_id": request.session_id,
                    "claim_text": request.claim_text,
                    "timestamp_seconds": int(request.timestamp_seconds or 0),
                    "verdict": result.verdict.value,
                    "verdict_summary": result.verdict_summary,
                    "source_name": result.source_name,
                    "source_url": result.source_url,
                }
            )
        except Exception as db_err:
            logger.error("Failed to persist claim to Supabase: %s", db_err)

        return result
    except Exception as e:
        logger.error("Fact-check endpoint error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/session", response_model=CreateSessionResponse)
async def create_session(request: CreateSessionRequest):
    try:
        session_id = supabase_client.create_session(
            preset=request.context_preset,
            context_detail=request.context_detail,
        )
        return CreateSessionResponse(session_id=session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/session/{session_id}", response_model=SessionDetail)
async def get_session(session_id: str):
    try:
        return supabase_client.get_session(session_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.patch("/api/session/{session_id}")
async def end_session(session_id: str):
    try:
        supabase_client.end_session(session_id)
        return {"status": "ended"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
