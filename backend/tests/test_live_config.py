"""Regression tests for Gemini Live VAD / claim-detection config."""

from live_config import build_live_connect_config


def test_server_vad_is_disabled() -> None:
    """Client Silero owns turn boundaries; auto-VAD must be off."""
    config = build_live_connect_config("test instruction")
    assert config.realtime_input_config is not None
    aad = config.realtime_input_config.automatic_activity_detection
    assert aad is not None
    assert aad.disabled is True


def test_report_claim_tool_is_registered() -> None:
    config = build_live_connect_config("test instruction")
    assert config.tools
    decls = config.tools[0].function_declarations
    assert decls
    assert decls[0].name == "report_claim"
