# FPIP Entra ID App Registrations (Phase 1 + Phase 2)

Three Entra ID app registrations are required by the end of Phase 2.

## 1. `FPIP-Web-SPA` — internal staff

| Property | Value |
|---|---|
| Display name | `FPIP-Web-SPA` |
| Supported account types | Single tenant (this customer's tenant) |
| Application type | Single-page application (SPA) |
| Redirect URIs | `http://localhost:5173/` (local dev) + the Azure Static Web App production URL (set after deploy) |
| API permissions (delegated) | **Dynamics CRM / Dataverse — `user_impersonation`** |
| Client (application) ID | → set as `VITE_AAD_CLIENT_ID` in `app/.env.local` |
| Tenant ID | → set as `VITE_AAD_TENANT_ID` / used in `VITE_AAD_AUTHORITY` |

This is the app the React SPA (`/app`) uses via `@azure/msal-react`. The acquired
token is sent as a bearer to the Dataverse Web API (see `app/src/api/dataverseClient.ts`).

## 2. `FPIP-Supplier-External` — Supplier Portal

| Property | Value |
|---|---|
| Display name | `FPIP-Supplier-External` |
| Supported account types | Entra External ID — guest/B2B or B2C flow (whichever the bank's setup supports) |
| Application type | Single-page application (SPA) |
| Redirect URIs | `http://localhost:5173/` (local dev) + Supplier Portal production URL |
| API permissions (delegated) | **Dynamics CRM / Dataverse — `user_impersonation`** |
| Notes | Kept **separate** from internal staff auth intentionally. A Supplier user's claims map to their `fpip_supplier` record and the `FPIP Supplier Portal User` role (see `dataverse/FPIP_Core/roles.md`). |

Build the Supplier Portal variant by pointing the Vite env at this registration:
`VITE_AAD_CLIENT_ID=<FPIP-Supplier-External client id>`,
`VITE_AAD_AUTHORITY=<External ID authority>`.

## 3. `FPIP-Agent-Service` — Phase 2 backend (confidential client)

| Property | Value |
|---|---|
| Display name | `FPIP-Agent-Service` |
| Supported account types | Single tenant (this customer's tenant) |
| Application type | Web / confidential client (no redirect URI needed) |
| API permissions (application) | **Dynamics CRM / Dataverse — `user_impersonation` app role** (app-only / service-principal access) |
| Client secret | Generated and stored in Azure Key Vault as `dataverse-client-secret` |
| Notes | Used by the LangGraph agent service (`agent-service/`) to query Dataverse. The service principal must be added as a Dataverse Application User and assigned a read-only security role such as `FPIP Auditor` or a custom `FPIP Agent Service` role. |

## Why three registrations

- Internal staff and external suppliers authenticate against different identity
  boundaries (home tenant vs. External ID), with separate redirect URIs and
  consent experiences.
- The agent service needs app-only access to Dataverse. It must not reuse the
  SPA registrations (which only have delegated permissions) and must not
  impersonate a user, because agents run server-side and need stable service
  access. At the same time, the React UI passes the calling user's context to
  the agent service so it can enforce the same data boundaries Dataverse would
  (especially Supplier isolation).
