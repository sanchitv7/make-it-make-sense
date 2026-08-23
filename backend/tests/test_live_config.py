"""Regression tests for Gemini Live VAD / claim-detection config."""

from google.genai import types

from live_config import build_live_connect_config


def test_server_vad_is_enabled() -> None:
    """Auto-VAD must not be disabled — that killed claim detection in prod."""
    config = build_live_connect_config("test instruction")
    aad = config.realtime_input_config.automatic_activity_detection
    assert aad is not None
    assert aad.disabled is not True


def test_server_vad_uses_high_sensitivity() -> None:
    config = build_live_connect_config("test instruction")
    aad = config.realtime_input_config.automatic_activity_detection
    assert aad.start_of_speech_sensitivity == types.StartSensitivity.START_SENSITIVITY_HIGH
    assert aad.end_of_speech_sensitivity == types.EndSensitivity.END_SENSITIVITY_HIGH
    assert aad.prefix_padding_ms == 20
    assert aad.silence_duration_ms == 400


def test_report_claim_tool_is_registered() -> None:
    config = build_live_connect_config("test instruction")
    assert config.tools
    decls = config.tools[0].function_declarations
    assert decls
    assert decls[0].name == "report_claim"
