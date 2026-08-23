"""Gemini Live session config used by /ws/live.

Server-side automatic activity detection must stay enabled unless the
browser reliably sends activity_start / activity_end. Disabling it without
working client VAD causes silent claim-detection failures (audio streams
with no turn boundaries, so report_claim never fires).
"""

from google.genai import types

REPORT_CLAIM_TOOL = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="report_claim",
            description="Report a verifiable factual claim heard in the audio",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "claim_text": types.Schema(type="STRING", description="The claim verbatim"),
                    "timestamp_seconds": types.Schema(
                        type="INTEGER", description="Seconds since session start"
                    ),
                    "context": types.Schema(
                        type="STRING",
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
    """Build LiveConnectConfig with server VAD and report_claim tool."""
    return types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction=system_instruction,
        input_audio_transcription=types.AudioTranscriptionConfig(),
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                start_of_speech_sensitivity=types.StartSensitivity.START_SENSITIVITY_HIGH,
                end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_HIGH,
                prefix_padding_ms=20,
                silence_duration_ms=400,
            ),
            activity_handling=types.ActivityHandling.NO_INTERRUPTION,
            turn_coverage=types.TurnCoverage.TURN_INCLUDES_ALL_INPUT,
        ),
        context_window_compression=types.ContextWindowCompressionConfig(
            sliding_window=types.SlidingWindow(),
        ),
        tools=[REPORT_CLAIM_TOOL],
    )
