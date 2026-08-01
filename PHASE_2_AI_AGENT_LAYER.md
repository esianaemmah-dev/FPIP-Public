# PHASE 2 — AI Agent Layer (LangGraph)
### Read this before writing any code. Context for the coding agent.

**Prerequisite**: Phase 1 must be done — Dataverse schema exists, React UI scaffold authenticates and reads/writes real records. If any Phase 1 acceptance checklist item is unchecked, stop and finish that first.

**Confirmed decision**: agents are built in **LangGraph (Python)**, not Copilot Studio. Do not introduce Copilot Studio, Bot Framework Composer, or any low-code agent designer anywhere in this phase.

---

## Goal of this phase

Build the nine FPIP agent personas (Executive, Procurement, Finance, Spend, Contract, Compliance, Risk, Knowledge, Supplier) as **one parameterized LangGraph graph**, expose them through **one FastAPI service**, deploy that service on **Azure Container Apps**, ground it in **Azure AI Search**, give it read access to **Dataverse and the Fabric SQL endpoint**, and wire the React UI's chat surfaces (the Command Center inline chat and the full Copilot page) to call it.

**Definition of done**: a logged-in user can ask the Executive Agent a question in the React UI, get a real LLM-generated answer grounded in actual Dataverse/Fabric/SharePoint data (not the hardcoded demo responses from `FPIP_UI_Demo.html`), and switch agents to get a different persona with a different scope.

---

## Task 1 — Repo structure

```
/agent-service
  /app
    agents_config.py     (the 9 agent definitions as data — system prompt, allowed tools, grounding index per agent)
    tools.py             (LangChain tool wrappers: Dataverse query tool, Fabric SQL query tool, Azure AI Search retriever tool)
    graph.py             (one create_react_agent-based graph builder, parameterized by agent_id)
    api.py               (FastAPI app: POST /agents/{agent_id}/invoke, GET /agents/{agent_id}/history/{thread_id})
    config.py            (env var loading — no secrets hardcoded, see Task 4)
  Dockerfile
  requirements.txt
  azure.yaml             (azd config for Container Apps deployment, if using Azure Developer CLI)
```

Do not create nine separate agent files or nine separate prompt-orchestration codebases — the whole point of this phase is that adding a tenth agent later means adding one entry to `agents_config.py`, not writing new code.

---

## Task 2 — Agent definitions

For each of the 9 agents, define in `agents_config.py`:
- `system_prompt` — reuse the tone and scope already established in the demo (`FPIP_UI_Demo.html`'s `responses` object and each agent's `scope` string are a good starting reference for voice and boundaries, but the real system prompt must explicitly state what the agent can read and that it **cannot approve, pay, or award anything** — this constraint must be in the prompt, not just implied)
- `tools` — which of the tools from `tools.py` this agent is allowed to call (e.g. the Procurement Agent gets the Tender/Bid Dataverse tool, not the Payment tool)
- `grounding_index` — which Azure AI Search index this agent's retriever tool searches (see Task 3)

Reuse the agent-to-scope mapping already defined in the UI demo's `agents` array as the starting spec; do not redesign the personas from scratch.

---

## Task 3 — Grounding (Azure AI Search)

Set up Azure AI Search indexes:
- `fpip-policies-index` — indexed from SharePoint (policy documents, procurement handbook)
- `fpip-contracts-index` — indexed from SharePoint/Dataverse contract records
- `fpip-supplier-docs-index` — indexed from SharePoint (compliance documents) — Supplier Agent and Compliance Agent read this

Use Azure AI Search's native SharePoint/OneDrive connector for ingestion (no custom crawler code). Each agent's retriever tool in `tools.py` should query only the index(es) relevant to its scope — do not give every agent access to every index.

---

## Task 4 — Tools: Dataverse and Fabric access

In `tools.py`, build:
- `dataverse_query_tool(table, filter_expression)` — calls the Dataverse Web API using a service principal (app-only Entra ID registration — create `FPIP-Agent-Service` app registration for this, separate from the two SPA registrations in Phase 1), respecting the same security-role boundaries where applicable (an agent invoked on behalf of a Supplier Portal user should not be able to query other suppliers' records — pass the calling user's context through and filter accordingly, don't rely solely on the service principal's broader access)
- `fabric_sql_tool(query)` — queries the Fabric Lakehouse SQL analytics endpoint for live banking/payment data, per the boundary defined in `03_Fabric_Integration_and_Managed_App.md`. This tool should only ever run read-only, parameterized queries — no dynamic SQL construction from raw LLM output; validate/allowlist the query shape before execution.

Secrets (Dataverse service principal credential, Fabric connection string, Azure OpenAI endpoint) come from **Azure Key Vault**, accessed via **Managed Identity** on the Container App — never hardcoded, never in `.env` files committed to the repo.

---

## Task 5 — FastAPI service and deployment

`api.py` exposes:
- `POST /agents/{agent_id}/invoke` — body: `{ message, thread_id, user_context }`; returns the agent's reply. `user_context` carries the calling user's role/supplier-id so tool calls can enforce the same data boundaries Dataverse itself would.
- Streaming: use Server-Sent Events or a chunked response so the React chat UI can render tokens as they arrive, matching the "typing" feel already prototyped in the demo.
- Conversation memory: use LangGraph's checkpointer backed by Cosmos DB (or Postgres Flexible Server) so `thread_id` persists across turns — don't keep conversation state only in-process memory, it won't survive a Container App scale event.

Deploy as an Azure Container App (consumption plan, scales to zero). Managed Identity grants it access to Key Vault, Azure OpenAI, and the Fabric SQL endpoint — no connection secrets in application code.

---

## Task 6 — Wire the React UI to the agent service

Replace the Phase 1 "coming in Phase 2" placeholder on the Copilot page, and the dashboard's inline chat widget, with real calls to `POST /agents/{agent_id}/invoke`. Reuse the UI structure already validated in `FPIP_UI_Demo.html` — agent picker list, message thread, composer pinned to the bottom, typing indicator — rebuilt as React state instead of the vanilla-JS `messageLog` object from the demo.

---

## Acceptance checklist for Phase 2

- [ ] All 9 agents defined as config entries in a single `agents_config.py`, not 9 separate codebases
- [ ] Each agent only has tools/grounding appropriate to its scope (verify the Supplier Agent cannot query another supplier's invoices, for example)
- [ ] Azure AI Search indexes are live and populated from SharePoint/OneDrive via the native connector
- [ ] Fabric SQL tool executes only read-only, allowlisted query shapes
- [ ] No secrets in code or committed config — everything through Key Vault + Managed Identity
- [ ] Conversation memory survives a service restart (test by scaling the Container App to zero and back)
- [ ] React Copilot page and dashboard inline chat both call the real agent service and stream responses
- [ ] Every agent's system prompt explicitly states it cannot approve, pay, or award — spot-check by asking an agent to "just approve this PO" and confirming it declines and explains why
