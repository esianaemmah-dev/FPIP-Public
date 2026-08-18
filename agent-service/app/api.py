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
from time import perf_counter
from hashlib import sha256
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from langchain_core.messages import AIMessageChunk, HumanMessage
from pydantic import BaseModel, ConfigDict, Field

from app.agents_config import AGENTS_BY_ID, get_agent_config
from app.graph import create_agent_graph
from app.enterprise_api import router as enterprise_router
from app.enterprise_controls import SlidingWindowRateLimiter
from app.security import Principal, authorize_agent, internal_thread_id, require_principal
from app.tools import USER_CONTEXT

logger = logging.getLogger(__name__)

from app.config import Config  # noqa: E402

app = FastAPI(title="FPIP Agent Service", version="2.1.0")
_RATE_LIMITER = SlidingWindowRateLimiter(Config.RATE_LIMIT_REQUESTS, Config.RATE_LIMIT_WINDOW_SECONDS)
app.include_router(enterprise_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


class InvokeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: str = Field(..., min_length=1, max_length=4000)
    thread_id: str | None = Field(default=None, min_length=1, max_length=160)


class MessageOut(BaseModel):
    role: str
    content: str


def _serialize_sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload)}\n\n"


@app.middleware("http")
async def security_headers(request: Request, call_next):
    started = perf_counter()
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    response = None
    if request.url.path.startswith(("/agents", "/controls")):
        credential = request.headers.get("Authorization", "")
        identity = sha256(credential.encode()).hexdigest() if credential else (request.client.host if request.client else "unknown")
        allowed, retry_after = _RATE_LIMITER.allow(identity)
        if not allowed:
            response = JSONResponse(status_code=429, content={"detail": "Request rate limit exceeded"}, headers={"Retry-After": str(max(1, int(retry_after)))})
    if response is None:
        response = await call_next(request)
    duration_ms = (perf_counter() - started) * 1000
    response.headers["X-Request-ID"] = request_id
    response.headers["X-FPIP-Region"] = Config.DEPLOYMENT_REGION
    response.headers["Server-Timing"] = f"app;dur={duration_ms:.2f}"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


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
    "I'm the FPIP Assistant â€” I only help with this platform's finance, procurement, "
    "contracts, invoices, approvals, budgets, compliance, and supplier records.\n\n"
    "I can't answer general topics (sports, news, trivia, etc.). "
    "Try something like: pending approvals, contracts renewing soon, or spend by category. "
    "If you meant an FPIP tender/contract related to an event, say so and I can search those records."
)


def _is_off_topic(message: str) -> bool:
    """Hard guard before the LLM â€” refuse clear out-of-scope questions."""
    if _FPIP_HINTS.search(message):
        return False
    return bool(_OFFTOPIC_HINTS.search(message))


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
async def ready() -> dict[str, Any]:
    checks = {
        "dataverse": bool(Config.DATAVERSE_URL and Config.DATAVERSE_CLIENT_ID),
        "openai": bool(Config.AZURE_OPENAI_ENDPOINT and Config.AZURE_OPENAI_DEPLOYMENT),
        "search": bool(Config.AZURE_SEARCH_ENDPOINT),
        "authentication": bool(Config.AGENT_API_AUDIENCE and Config.AGENT_API_TENANT_ID),
    }
    if Config.APP_ENV == "production" and not all(checks.values()):
        raise HTTPException(status_code=503, detail={"status": "not_ready", "checks": checks})
    return {"status": "ready" if all(checks.values()) else "degraded", "checks": checks}


@app.get("/agents")
async def list_agents(principal: Principal = Depends(require_principal)) -> list[dict[str, Any]]:
    return [
        {
            "id": a.agent_id,
            "name": a.name,
            "allowed_tools": list(a.allowed_tools),
            "grounding_indexes": list(a.grounding_indexes),
        }
        for a in AGENTS_BY_ID.values()
        if _can_access_agent(principal, a.agent_id)
    ]


def _can_access_agent(principal: Principal, agent_id: str) -> bool:
    try:
        authorize_agent(principal, agent_id)
        return True
    except HTTPException:
        return False


@app.post("/agents/{agent_id}/invoke")
async def invoke_agent(
    agent_id: str,
    request: InvokeRequest,
    principal: Principal = Depends(require_principal),
) -> StreamingResponse:
    try:
        get_agent_config(agent_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    authorize_agent(principal, agent_id)

    thread_id = request.thread_id or str(uuid.uuid4())
    graph_thread_id = internal_thread_id(principal, thread_id)
    if _is_off_topic(request.message):

        async def refuse_stream():
            yield _serialize_sse(
                {"type": "token", "thread_id": thread_id, "content": _OFFTOPIC_REPLY}
            )
            yield _serialize_sse({"type": "done", "thread_id": thread_id})

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
        token = USER_CONTEXT.set({**principal.tool_context(), "agent_id": agent_id})
        try:
            graph = create_agent_graph(agent_id)
            config = {"configurable": {"thread_id": graph_thread_id}}
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
        except Exception:
            error_id = str(uuid.uuid4())
            logger.exception("Agent invocation failed error_id=%s", error_id)
            yield _serialize_sse(
                {"type": "error", "thread_id": thread_id, "message": "Agent request failed", "error_id": error_id}
            )
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
async def get_history(
    agent_id: str,
    thread_id: str,
    principal: Principal = Depends(require_principal),
) -> list[MessageOut]:
    try:
        get_agent_config(agent_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    authorize_agent(principal, agent_id)
    try:
        graph = create_agent_graph(agent_id)
        config = {"configurable": {"thread_id": internal_thread_id(principal, thread_id)}}
        snapshot = graph.get_state(config)
    except HTTPException:
        raise
    except Exception as exc:
        error_id = str(uuid.uuid4())
        logger.exception("History lookup failed error_id=%s", error_id)
        raise HTTPException(status_code=500, detail={"message": "History lookup failed", "error_id": error_id}) from exc

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

