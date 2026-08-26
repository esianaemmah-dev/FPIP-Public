"""Structural tests for the ChatOpenAI-on-the-v1-endpoint migration in graph.py.

These confirm the client is *built* correctly (base_url, model, credential
plumbing) and that `create_agent_graph` wires the right tools/prompt/
checkpointer for a persona — they cannot confirm an actual token stream
against a live Azure OpenAI deployment (that needs a real endpoint and a
manual/staging smoke test), but they lock in the shape of the migration so a
future refactor can't silently drop a required kwarg.
"""
from __future__ import annotations

import pytest

from app.agents_config import get_agent_config
from app.config import Config
from app.tools import resolve_tools


@pytest.fixture(autouse=True)
def _valid_openai_config(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(Config, "AZURE_OPENAI_ENDPOINT", "https://fpip-test.openai.azure.com")
    monkeypatch.setattr(Config, "AZURE_OPENAI_DEPLOYMENT", "gpt-4o-fpip")
    monkeypatch.setattr(Config, "AZURE_OPENAI_API_KEY", "test-key")


def test_build_llm_rejects_missing_configuration(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.graph import _build_llm

    monkeypatch.setattr(Config, "AZURE_OPENAI_ENDPOINT", "")
    with pytest.raises(RuntimeError, match="not configured"):
        _build_llm()


def test_build_llm_rejects_placeholder_configuration(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.graph import _build_llm

    monkeypatch.setattr(Config, "AZURE_OPENAI_DEPLOYMENT", "placeholder")
    with pytest.raises(RuntimeError, match="placeholder"):
        _build_llm()


def test_build_llm_targets_the_v1_endpoint_with_the_deployment_as_model() -> None:
    from app.graph import _build_llm

    llm = _build_llm()
    assert llm.openai_api_base == "https://fpip-test.openai.azure.com/openai/v1/"
    assert llm.model_name == "gpt-4o-fpip"
    assert llm.reasoning_effort == "low"
    assert llm.stream_usage is True
    assert llm.max_retries == 2


def test_build_llm_prefers_api_key_when_present() -> None:
    from app.graph import _build_llm

    llm = _build_llm()
    assert llm.openai_api_key.get_secret_value() == "test-key"


def test_build_llm_falls_back_to_managed_identity_without_an_api_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(Config, "AZURE_OPENAI_API_KEY", None)

    class _FakeCredential:
        pass

    calls: dict[str, object] = {}

    def _fake_token_provider(credential: object, scope: str):
        calls["credential"] = credential
        calls["scope"] = scope
        return lambda: "fake-bearer-token"

    monkeypatch.setattr("azure.identity.DefaultAzureCredential", _FakeCredential)
    monkeypatch.setattr("azure.identity.get_bearer_token_provider", _fake_token_provider)

    from app.graph import _build_llm

    llm = _build_llm()
    assert calls["scope"] == "https://cognitiveservices.azure.com/.default"
    assert isinstance(calls["credential"], _FakeCredential)
    assert llm.openai_api_key() == "fake-bearer-token"


def test_create_agent_graph_wires_the_configured_tools_and_prompt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.graph as graph_module

    captured: dict[str, object] = {}

    def _fake_create_react_agent(*, model, tools, prompt, checkpointer):
        captured.update(model=model, tools=tools, prompt=prompt, checkpointer=checkpointer)
        return "compiled-graph"

    monkeypatch.setattr(graph_module, "create_react_agent", _fake_create_react_agent)

    result = graph_module.create_agent_graph("procurement")

    assert result == "compiled-graph"
    cfg = get_agent_config("procurement")
    assert captured["prompt"] == cfg.system_prompt
    assert [t.name for t in captured["tools"]] == [t.name for t in resolve_tools(cfg.allowed_tools)]
    assert captured["checkpointer"] is graph_module._CHECKPOINTER


def test_create_agent_graph_rejects_unknown_agent() -> None:
    from app.graph import create_agent_graph

    with pytest.raises(ValueError, match="Unknown agent"):
        create_agent_graph("not-a-real-agent")
