"""LangGraph graph builder — one graph, parameterized by agent_id.

The 9 agents share the same ReAct-style graph structure; only the system prompt
and the tool subset change (driven by agents_config.py).
"""
from __future__ import annotations

import logging
import os
from typing import Any

from langchain_openai import ChatOpenAI
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.prebuilt import create_react_agent

from app.agents_config import AgentConfig, get_agent_config
from app.config import Config
from app.tools import resolve_tools

logger = logging.getLogger(__name__)


def _get_checkpointer() -> BaseCheckpointSaver | None:
    """Return a persistent Cosmos DB checkpointer if configured, else in-memory."""
    cosmos_endpoint = os.getenv("COSMOS_DB_ENDPOINT")
    cosmos_conn = Config.COSMOS_DB_CONNECTION_STRING
    cosmos_container = os.getenv("COSMOS_DB_CONTAINER", "checkpoints")
    if cosmos_endpoint:
        try:
            from langgraph_checkpoint_cosmos import CosmosDBSaver

            logger.info("Using Cosmos DB checkpointer with endpoint.")
            return CosmosDBSaver.from_conn_info(
                endpoint=cosmos_endpoint,
                credential=None,
                database_name=Config.COSMOS_DB_DATABASE,
                container_name=cosmos_container,
            )
        except Exception as exc:
            logger.warning(
                "Cosmos DB checkpointer unavailable (%s); falling back to in-memory.",
                exc,
            )
    elif cosmos_conn:
        logger.warning(
            "COSMOS_DB_ENDPOINT not set. COSMOS_DB_CONNECTION_STRING is ignored; "
            "configure COSMOS_DB_ENDPOINT for Cosmos DB persistence."
        )

    try:
        from langgraph.checkpoint.memory import MemorySaver

        logger.warning(
            "Using in-memory checkpointer. Conversation state will be lost on restart. "
            "Set COSMOS_DB_ENDPOINT for production persistence."
        )
        return MemorySaver()
    except Exception as exc:
        logger.error("No checkpointer available: %s", exc)
        return None


_CHECKPOINTER: BaseCheckpointSaver | None = _get_checkpointer()


def _build_llm() -> ChatOpenAI:
    """Build the Azure OpenAI v1 client for FPIP agents."""
    endpoint = (Config.AZURE_OPENAI_ENDPOINT or "").rstrip("/")
    deployment = Config.AZURE_OPENAI_DEPLOYMENT

    if not endpoint or not deployment:
        raise RuntimeError(
            "Azure OpenAI is not configured. Set AZURE_OPENAI_ENDPOINT and "
            "AZURE_OPENAI_DEPLOYMENT."
        )

    if "example.openai.azure.com" in endpoint or deployment.lower() in {
        "dummy",
        "placeholder",
    }:
        raise RuntimeError("Azure OpenAI still has placeholder settings.")

    kwargs: dict[str, Any] = {
        "model": deployment,
        "base_url": f"{endpoint}/openai/v1/",
        "reasoning_effort": "low",
        "stream_usage": True,
        "max_retries": 2,
        "timeout": 60,
    }

    if Config.AZURE_OPENAI_API_KEY:
        kwargs["api_key"] = Config.AZURE_OPENAI_API_KEY
    else:
        from azure.identity import (
            DefaultAzureCredential,
            get_bearer_token_provider,
        )

        kwargs["api_key"] = get_bearer_token_provider(
            DefaultAzureCredential(),
            "https://cognitiveservices.azure.com/.default",
        )

    return ChatOpenAI(**kwargs)


def create_agent_graph(agent_id: str) -> Any:
    """Build and return the compiled LangGraph agent for the given persona."""
    cfg: AgentConfig = get_agent_config(agent_id)
    tools = resolve_tools(cfg.allowed_tools)
    llm = _build_llm()

    if _CHECKPOINTER is None:
        raise RuntimeError(
            "No checkpointer is available. Configure COSMOS_DB_CONNECTION_STRING "
            "or ensure langgraph.checkpoint.memory is importable."
        )

    return create_react_agent(
        model=llm,
        tools=tools,
        prompt=cfg.system_prompt,
        checkpointer=_CHECKPOINTER,
    )
