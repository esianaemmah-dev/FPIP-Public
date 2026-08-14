# FPIP Agent Service — Phase 2 (LangGraph)

FastAPI service hosting the 9 FPIP agent personas as one parameterized
LangGraph graph.

## Run locally

```bash
cd agent-service
cp .env.example .env        # fill in secrets (never commit .env)
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.api:app --reload --port 8000
```

OpenAPI docs: http://localhost:8000/docs

## Architecture

```
React UI  ──►  POST /agents/{agent_id}/invoke  (SSE stream)
                    │
                    ▼
            FastAPI (app/api.py)
                    │
                    ▼
            create_react_agent graph (app/graph.py)
                    │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
  dataverse_query  fabric_sql_query  search_*_tool
        │              │              │
   Dataverse      Fabric SQL      Azure AI Search
   (FPIP_Core)    analytics       (SharePoint-backed)
```

## Configuration

In production, secrets are loaded through `AZURE_KEY_VAULT_URL`; non-secret
identity controls remain explicit Container App environment settings. Local
development can fall back to environment variables listed in `.env.example`.

Required production identity settings:

| Setting | Purpose |
|---|---|
| `APP_ENV=production` | Activates fail-closed production checks |
| `AUTH_DISABLED=false` | Prevents local authentication bypass |
| `AGENT_API_TENANT_ID` | Customer Entra tenant accepted by the API |
| `AGENT_API_AUDIENCE` | FPIP Agent Service application ID URI |
| `ENTRA_GROUP_ROLE_MAP` | Optional group-object-ID to FPIP-role JSON mapping |
| `SUPPLIER_ID_CLAIM` | Verified token claim carrying the Dataverse supplier GUID |
| `CORS_ORIGINS` | Exact approved SPA origins; wildcards are not used |

Key Vault secret names:

| Secret name | Purpose |
|---|---|
| `dataverse-url` | Dataverse environment URL |
| `dataverse-tenant-id` | FPIP-Agent-Service SP tenant |
| `dataverse-client-id` | FPIP-Agent-Service app id |
| `dataverse-client-secret` | FPIP-Agent-Service secret |
| `azure-openai-endpoint` | Azure OpenAI resource URL |
| `azure-openai-api-key` | Azure OpenAI API key (optional; MI token also possible) |
| `azure-openai-deployment-name` | GPT-4o deployment name |
| `azure-search-endpoint` | Azure AI Search URL |
| `azure-search-key` | Azure AI Search admin/query key (optional with MI) |
| `fabric-connection-string` | Fabric SQL analytics endpoint connection string |
| `cosmos-db-connection-string` | Cosmos DB for conversation persistence |

## Agents

All 9 agents are defined in `app/agents_config.py`. Each entry specifies the
system prompt (with the read-only constraint), allowed tools, and grounding
indexes. No new code is required to add a persona.

## Tool boundaries

- `dataverse_query_tool` — read-only GET against FPIP_Core tables. The API derives
  identity and role from a verified Entra token, applies an agent-specific table
  allowlist, and requires supplier self-filters for supplier-facing records.
- `fabric_sql_query_tool` — only predefined allowlisted queries; the LLM cannot
  generate arbitrary SQL.
- `search_*_tool` — each searches only the Azure AI Search index named in the
  tool; supplier-document search adds a verified supplier filter.
- `write_audit_log_tool` — best-effort trail of AI-inspected records.

External thread IDs are hashed together with the verified Entra subject before
they reach the LangGraph checkpointer, preventing one user from retrieving
another user's conversation by guessing a thread ID.
