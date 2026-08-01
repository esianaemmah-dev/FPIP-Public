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

In production, set only `AZURE_KEY_VAULT_URL`. The Container App's Managed
Identity fetches all other secrets from Key Vault. Local development can fall
back to environment variables listed in `.env.example`.

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

- `dataverse_query_tool` — read-only GET against FPIP_Core tables. Supplier
  isolation is enforced by appending a supplier filter when `user_context.role`
  is `'supplier'`.
- `fabric_sql_query_tool` — only predefined allowlisted queries; the LLM cannot
  generate arbitrary SQL.
- `search_*_tool` — each searches only the Azure AI Search index named in the
  tool; agents receive only the indexes configured in their `grounding_indexes`.
- `write_audit_log_tool` — best-effort trail of AI-inspected records.
