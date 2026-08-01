# FPIP Entra ID Setup (Phase 1, Task 2)

Phase 1 needs two Entra ID app registrations (see `appRegistrations.md` for the
full spec). A third (`FPIP-Agent-Service`) is **not** created until Phase 2.

## Security groups (RBAC)

Department roles in the SPA resolve from Entra security group membership
(`idTokenClaims.groups` → `VITE_ENTRA_GROUP_MAP`).

```powershell
.\entra\create-FpipSecurityGroups.ps1
```

Creates (or reuses) `FPIP-Platform-Admin`, `FPIP-Executive`, `FPIP-Procurement`,
`FPIP-Finance`, `FPIP-Auditor`, `FPIP-Supplier`, writes `group-role-map.json`,
and prints the `VITE_ENTRA_GROUP_MAP=...` line for `app/.env.production`.

Assign users to groups in Entra admin center (or `az ad group member add`).
The SPA app registration must emit groups: `groupMembershipClaims=SecurityGroup`.

## Files

| File | Purpose |
|---|---|
| `appRegistrations.md` | Spec for `FPIP-Web-SPA` and `FPIP-Supplier-External` |
| `create-FpipAppRegistrations.ps1` | Microsoft Graph PowerShell script to create both app registrations + service principals + the Dataverse `user_impersonation` delegated permission |
| `create-FpipSecurityGroups.ps1` | Create department security groups + emit `VITE_ENTRA_GROUP_MAP` |
| `group-role-map.json` | Generated Object ID → role map (do not hand-edit in production) |

## Run (on a machine with the Microsoft Graph PowerShell SDK)

> The Microsoft Graph PowerShell SDK is **not** installed in this dev environment,
> so the script was not executed here.

```powershell
Install-Module Microsoft.Graph.Authentication -Scope CurrentUser
Install-Module Microsoft.Graph.Applications    -Scope CurrentUser
cd entra
.\create-FpipAppRegistrations.ps1
```

The script prints the client (application) IDs to wire into `app/.env.local`:
`VITE_AAD_CLIENT_ID`, `VITE_AAD_TENANT_ID`, `VITE_AAD_AUTHORITY`, `VITE_DATAVERSE_URL`.

## Manual alternative (Entra admin center)

If you prefer the portal:
1. **App registrations → New registration** → `FPIP-Web-SPA`, single tenant.
2. Add a platform → **Single-page application (SPA)** → redirect URI `http://localhost:5173/`.
3. **API permissions → Add a permission → APIs my organization uses → Dynamics CRM** →
   **Delegated → user_impersonation** → **Grant admin consent**.
4. Repeat for `FPIP-Supplier-External` (External ID audience).
5. After the Static Web App deploys, add its production URL as a second redirect URI.

## Auth flow in the app

The React SPA uses `@azure/msal-browser` + `@azure/msal-react` (config in
`app/src/auth/msalConfig.ts`). On login it acquires a token for the Dataverse
scope (`<dataverse-url>/.default` or the explicit `user_impersonation` scope) and
attaches it as a bearer to every Dataverse Web API call
(`app/src/api/dataverseClient.ts`). Dataverse's own security roles enforce what
the authenticated user can read/write — including Supplier isolation.
