"""FastAPI service exposing the FPIP LangGraph agent layer.

Endpoints:
  POST /agents/{agent_id}/invoke          streaming invocation via SSE
  GET  /agents/{agent_id}/history/{thread_id}  persisted conversation history
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessageChunk, HumanMessage
from pydantic import BaseModel, Field

from app.agents_config import AGENTS_BY_ID, get_agent_config
from app.graph import create_agent_graph
from app.tools import USER_CONTEXT

logger = logging.getLogger(__name__)

from app.config import Config  # noqa: E402

app = FastAPI(title="FPIP Agent Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class InvokeRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    thread_id: str | None = None
    user_context: dict[str, Any] = Field(default_factory=dict)


class MessageOut(BaseModel):
    role: str
    content: str


def _serialize_sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload)}\n\n"


_FPIP_HINTS = re.compile(
    r"\b(invoice|tender|contract|approval|budget|spend|supplier|procurement|finance|"
    r"compliance|risk|requisition|payment|policy|fpip|novaris|audit|bid|rfp|rfq|"
    r"purchase\s*order|\bpo\b|exception|renewal|onboard|sod|framework)\b",
    re.I,
)
_OFFTOPIC_HINTS = re.compile(
    r"\b(world\s*cup|fifa|football|soccer|nba|nfl|cricket|olympics|movie|film|"
    r"weather|joke|recipe|celebrity|politics|election|who\s+won|live\s+score|"
    r"champions\s+league|premier\s+league)\b",
    re.I,
)

_OFFTOPIC_REPLY = (
    "I'm the FPIP Assistant — I only help with this platform's finance, procurement, "
    "contracts, invoices, approvals, budgets, compliance, and supplier records.\n\n"
    "I can't answer general topics (sports, news, trivia, etc.). "
    "Try something like: pending approvals, contracts renewing soon, or spend by category. "
    "If you meant an FPIP tender/contract related to an event, say so and I can search those records."
)


def _is_off_topic(message: str) -> bool:
    """Hard guard before the LLM — refuse clear out-of-scope questions."""
    if _FPIP_HINTS.search(message):
        return False
    return bool(_OFFTOPIC_HINTS.search(message))


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/agents")
async def list_agents() -> list[dict[str, Any]]:
    return [
        {
            "id": a.agent_id,
            "name": a.name,
            "allowed_tools": list(a.allowed_tools),
            "grounding_indexes": list(a.grounding_indexes),
        }
        for a in AGENTS_BY_ID.values()
    ]


@app.post("/agents/{agent_id}/invoke")
async def invoke_agent(agent_id: str, request: InvokeRequest) -> StreamingResponse:
    try:
        get_agent_config(agent_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    thread_id = request.thread_id or str(uuid.uuid4())
    token = USER_CONTEXT.set(request.user_context)

    if _is_off_topic(request.message):

        async def refuse_stream():
            try:
                yield _serialize_sse(
                    {"type": "token", "thread_id": thread_id, "content": _OFFTOPIC_REPLY}
                )
                yield _serialize_sse({"type": "done", "thread_id": thread_id})
            finally:
                USER_CONTEXT.reset(token)

        return StreamingResponse(
            refuse_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    async def event_stream():
        try:
            graph = create_agent_graph(agent_id)
            config = {"configurable": {"thread_id": thread_id}}
            input_state = {"messages": [HumanMessage(content=request.message)]}

            async for chunk, metadata in graph.astream(
                input_state, config, stream_mode="messages"
            ):
                if isinstance(chunk, AIMessageChunk) and chunk.content:
                    yield _serialize_sse(
                        {
                            "type": "token",
                            "thread_id": thread_id,
                            "content": chunk.content,
                        }
                    )

            yield _serialize_sse({"type": "done", "thread_id": thread_id})
        except Exception as exc:
            logger.exception("Agent invocation failed")
            yield _serialize_sse({"type": "error", "thread_id": thread_id, "message": str(exc)})
        finally:
            USER_CONTEXT.reset(token)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/agents/{agent_id}/history/{thread_id}")
async def get_history(agent_id: str, thread_id: str) -> list[MessageOut]:
    try:
        graph = create_agent_graph(agent_id)
        config = {"configurable": {"thread_id": thread_id}}
        snapshot = graph.get_state(config)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    messages = []
    if snapshot and snapshot.values and isinstance(snapshot.values.get("messages"), list):
        messages = snapshot.values["messages"]

    return [
        MessageOut(role=_role_for(m), content=str(getattr(m, "content", "")))
        for m in messages
    ]


def _role_for(message: Any) -> str:
    mapping = {"human": "user", "ai": "agent", "tool": "tool"}
    if hasattr(message, "type"):
        return mapping.get(str(message.type), str(message.type))
    return "unknown"
