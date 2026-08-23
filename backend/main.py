import asyncio
import base64
import json
import logging
import os

from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.websockets import WebSocketDisconnect
from google import genai
from google.genai import types

import supabase_client
from auth import require_user, verify_access_token
from cors_origins import VERCEL_APP_ORIGIN_REGEX, parse_allowed_origins
from fact_check import fact_check_claim, init_pool
from live_config import build_live_connect_config
from models import (
    CreateSessionRequest,
    CreateSessionResponse,
    FactCheckRequest,
    FactCheckResponse,
    SessionDetail,
    SessionListResponse,
)
from prompts import PROMPTS
from session_blurb import generate_session_title_blurb

load_dotenv()

logger = logging.getLogger(__name__)
GEMINI_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"

app = FastAPI(title="Make It Make Sense", version="0.1.0")

_cors_origins = parse_allowed_origins(os.environ.get("ALLOWED_ORIGINS"))


@app.on_event("startup")
async def startup():
    await init_pool()


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=os.environ.get("ALLOWED_ORIGIN_REGEX", VERCEL_APP_ORIGIN_REGEX),
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
        calls = [
            {"id": fc.id, "name": fc.name, "args": fc.args}
            for fc in (response.tool_call.function_calls or [])
        ]
        return {"toolCall": {"functionCalls": calls}}
    return None


@app.websocket("/ws/live")
async def live_ws(
    websocket: WebSocket,
    preset: str = Query(default="podcast"),
):
    # Accept first; auth is the first client message (not a query param).
    await websocket.accept()
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=10)
        auth_msg = json.loads(raw)
    except (TimeoutError, json.JSONDecodeError, WebSocketDisconnect):
        await websocket.close(code=4401, reason="Unauthorized")
        return

    if auth_msg.get("type") != "auth" or not auth_msg.get("access_token"):
        await websocket.close(code=4401, reason="Unauthorized")
        return
    try:
        verify_access_token(auth_msg["access_token"])
    except HTTPException:
        await websocket.close(code=4401, reason="Unauthorized")
        return

    await websocket.send_text(json.dumps({"type": "auth_ok"}))

    system_instruction = PROMPTS.get(preset, PROMPTS["podcast"])
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    config = build_live_connect_config(system_instruction)

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
                        elif data.get("type") == "activity_start":
                            await session.send_realtime_input(activity_start=types.ActivityStart())
                        elif data.get("type") == "activity_end":
                            await session.send_realtime_input(activity_end=types.ActivityEnd())
                        elif data.get("type") == "tool_response":
                            responses = [
                                types.FunctionResponse(
                                    id=fr["id"], name=fr["name"], response=fr["response"]
                                )
                                for fr in data.get("functionResponses", [])
                                if fr.get("id")
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
async def check_fact(
    request: FactCheckRequest,
    user_id: str = Depends(require_user),
):
    try:
        supabase_client.assert_session_owner(request.session_id, user_id)
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Fact-check endpoint error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/session", response_model=CreateSessionResponse)
async def create_session(
    request: CreateSessionRequest,
    user_id: str = Depends(require_user),
):
    try:
        session_id = supabase_client.create_session(
            preset=request.context_preset,
            user_id=user_id,
            context_detail=request.context_detail,
        )
        return CreateSessionResponse(session_id=session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions", response_model=SessionListResponse)
async def list_sessions(
    user_id: str = Depends(require_user),
):
    try:
        sessions = supabase_client.list_sessions_for_user(user_id, limit=100)
        return SessionListResponse(sessions=sessions)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/session/{session_id}", response_model=SessionDetail)
async def get_session(
    session_id: str,
    user_id: str = Depends(require_user),
):
    try:
        return supabase_client.get_session(session_id, user_id=user_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


async def _generate_and_persist_session_blurb(session_id: str) -> None:
    try:
        detail = supabase_client.get_session(session_id)
        claims = detail.get("claims") or []
        if not claims:
            return
        result = await generate_session_title_blurb(
            context_preset=detail["context_preset"],
            context_detail=detail.get("context_detail"),
            claims=claims,
        )
        if result is None:
            return
        supabase_client.update_session_blurb(session_id, result.title, result.blurb)
    except Exception:
        logger.exception("Failed to generate session title/blurb for %s", session_id)


@app.patch("/api/session/{session_id}")
async def end_session(
    session_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(require_user),
):
    try:
        supabase_client.assert_session_owner(session_id, user_id)
        supabase_client.end_session(session_id)
        background_tasks.add_task(_generate_and_persist_session_blurb, session_id)
        return {"status": "ended"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
