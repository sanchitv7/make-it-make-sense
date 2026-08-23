"""Gemini Live session config used by /ws/live.

Automatic server VAD is disabled. The browser owns turn boundaries via
Silero (activity_start / activity_end). Gemini ignores client activity
signals unless auto-VAD is disabled.
"""

from google.genai import types

REPORT_CLAIM_TOOL = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="report_claim",
            description="Report a verifiable factual claim heard in the audio",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "claim_text": types.Schema(
                        type=types.Type.STRING, description="The claim verbatim"
                    ),
                    "timestamp_seconds": types.Schema(
                        type=types.Type.INTEGER, description="Seconds since session start"
                    ),
                    "context": types.Schema(
                        type=types.Type.STRING,
                        description=(
                            "1-2 surrounding sentences providing context for the claim "
                            "(who is speaking, what they were discussing)"
                        ),
                    ),
                },
                required=["claim_text", "timestamp_seconds"],
            ),
        )
    ]
)


def build_live_connect_config(system_instruction: str) -> types.LiveConnectConfig:
    """Build LiveConnectConfig with client Silero VAD and report_claim tool."""
    return types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        system_instruction=system_instruction,
        input_audio_transcription=types.AudioTranscriptionConfig(),
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                disabled=True,
            ),
            activity_handling=types.ActivityHandling.NO_INTERRUPTION,
            turn_coverage=types.TurnCoverage.TURN_INCLUDES_ALL_INPUT,
        ),
        context_window_compression=types.ContextWindowCompressionConfig(
            sliding_window=types.SlidingWindow(),
        ),
        tools=[REPORT_CLAIM_TOOL],
    )
