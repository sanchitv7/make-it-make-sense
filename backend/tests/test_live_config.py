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


def test_input_transcription_hints_english() -> None:
    """Bias Live STT toward English so far-field audio does not jump scripts."""
    config = build_live_connect_config("test instruction")
    assert config.input_audio_transcription is not None
    assert config.input_audio_transcription.language_codes == ["en-US"]


def test_claim_detection_prompt_requires_english() -> None:
    from prompts import PROMPTS

    for name, prompt in PROMPTS.items():
        assert "English" in prompt, name
