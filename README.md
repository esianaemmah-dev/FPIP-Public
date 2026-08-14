# FPIP — Finance & Procurement Intelligence Platform

Azure Managed Application for financial institutions. This repository contains
Phases 1, 2, and 3:

- **Phase 1 — Foundation**: Dataverse schema, Entra ID auth, Managed Application
  skeleton, and a React UI scaffold that authenticates and reads/writes real
  Dataverse records across the five FPIP modules.
- **Phase 2 — AI Agent Layer**: a LangGraph-based agent service (Python/FastAPI)
  deployed on Azure Container Apps, with read-only tools for Dataverse, Fabric
  SQL, and Azure AI Search, wired to the React chat surfaces.
- **Phase 3 — Integration, Compliance & Marketplace Readiness**: Power Automate
  approval flows, configurable approval policies in Dataverse, SharePoint/Fabric
  onboarding docs, governance/audit UI, Managed Application package finalization,
  and an optional Marketplace Metering webhook.

## Confirmed architecture (do not deviate without flagging)

- Distribution: **Azure Managed Application** — resources deploy into the customer's tenant.
- Data layer: **Microsoft Dataverse** (solution `FPIP_Core`, 13 tables).
- Frontend: **custom React app** (Vite + TS), hosted on Azure Static Web Apps.
- Auth: **Microsoft Entra ID** via MSAL.
- Banking data: arrives via **Microsoft Fabric** only (no direct core-banking connector).
- Documents: **SharePoint/OneDrive**, referenced from Dataverse.
- AI agents: **LangGraph** (Phase 2 — not Copilot Studio).
- Approvals: **Power Automate** flows against the `fpip_approvalrequest` table.

## Repository layout

```
app/               # React UI scaffold (Vite + React + TS, MSAL, Dataverse client)
agent-service/     # Phase 2 — LangGraph FastAPI service
infra/             # Managed Application package (mainTemplate / createUiDefinition / viewDefinition)
dataverse/         # FPIP_Core solution (13 tables) + security roles + provisioning script
entra/             # Entra ID app registrations (FPIP-Web-SPA, FPIP-Supplier-External, FPIP-Agent-Service)
power-automate/    # Phase 3 — four approval flow JSON definitions
metering-webhook/  # Phase 3 — optional Marketplace Metering webhook Azure Function
docs/              # Phase 3 — Fabric and SharePoint onboarding guides for customers
```

## Quick start — React app

```powershell
cd app
cp .env.example .env.local      # fill in Entra ID + Dataverse + agent-service URL, OR:
#   set VITE_USE_DEMO_DATA=true for local visual review with seed data (no auth/Dataverse)
npm install
npm run dev                     # http://localhost:5173
```

`npm run build` type-checks (`tsc -b`) and produces the production bundle in
`app/dist/` (Azure Static Web Apps deploy target).

## Quick start — agent service (local)

```powershell
cd agent-service
cp .env.example .env            # fill in secrets (never commit .env)
python -m venv .venv
.venv\Scripts\Activate.ps1     # Windows
pip install -r requirements.txt
uvicorn app.api:app --reload    # http://localhost:8000/docs
```

In production the service runs in Azure Container Apps and loads all secrets from
Azure Key Vault via Managed Identity.

## Phase 1 / 2 / 3 acceptance status

| Item | Status |
|---|---|
| Dataverse solution `FPIP_Core` (13 tables, 6 roles incl. agent service) defined | ✅ |
| Configurable `fpip_approvalpolicy` table for approval thresholds | ✅ |
| Supplier isolation guarantee | ⚠️ Spec'd — **must be verified with a real test Supplier user** |
| React app authenticates via MSAL | ✅ Apps registered; SPA redeployed with Entra + Dataverse env |
| Five module pages read/write real Dataverse data | ⚠️ Schema live — needs security roles + first login test |
| Requisition created in UI persists in Dataverse | ⚠️ Ready to verify after roles |
| 9 agents defined as config entries in one `agents_config.py` | ✅ |
| Each agent has scoped tools/grounding indexes | ✅ |
| Read-only constraint in every system prompt | ✅ |
| Dataverse + Fabric SQL + Azure AI Search tools | ✅ (needs live resources) |
| FastAPI service streams responses via SSE | ✅ |
| Conversation memory via Cosmos DB checkpointer | ✅ (falls back to in-memory) |
| React Copilot page and dashboard chat call the agent service | ✅ |
| Power Automate flow JSON definitions (4 flows) | ✅ |
| Governance page reads real `fpip_auditlogentry` and shows approval policies | ✅ |
| ARM templates finalized with real agent container + optional metering webhook | ✅ |
| Customer onboarding docs for Fabric and SharePoint | ✅ |
| Marketplace Metering webhook Function App code | ✅ |
| Managed Application package validates and deploys cleanly | ✅ Validated against `rg-fpip-west` |
| Dataverse `FPIP_Core` provisioned into customer org | ⚙️ Configure per deployment |

Items marked ⚠️ require a live Azure/Dataverse/Entra/Fabric environment to complete.
The code and definitions are complete and ready for that environment.

## Finish deployment (live environment)

Deployment-specific IDs and URLs belong in the gitignored `deployment-state.json`.

- Dataverse: `<your-dataverse-url>` — provision the current 13-table manifest
- SPA: `<your-static-web-app-url>`
- Agent: `<your-container-app-url>`
- Entra apps: create `FPIP-Web-SPA`, `FPIP-Supplier-External`, and `FPIP-Agent-Service` per `entra/README.md`

**Still manual in Power Platform:**

1. Configure the 6 security roles per `dataverse/FPIP_Core/roles.md`
2. Add a Dataverse **Application User** for your `FPIP-Agent-Service` client ID and assign **FPIP Agent Service**
3. Sign in to the SPA and create a test requisition
4. Import Power Automate flows; then Fabric / SharePoint / Purview per `docs/`

```powershell
.\scripts\finish-deployment.ps1
```
