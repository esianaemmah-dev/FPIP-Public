# FPIP Security Policy

## Reporting a vulnerability

Do not disclose suspected vulnerabilities in a public issue. Send the report to
the private security contact configured by the deploying institution and include
the affected component, reproduction steps, business impact, and suggested
mitigation. The institution must configure a monitored security contact before
production go-live.

## Security boundaries

- Microsoft Entra ID is the identity authority for the React SPA and agent API.
- The agent API derives role and supplier identity from verified token claims;
  caller-supplied authorization context is ignored.
- Dataverse remains the authoritative record store and row-level enforcement
  layer. Frontend RBAC is navigation control, not a substitute for Dataverse roles.
- Agent tools are read-only except for append-only AI audit events.
- Banking data enters through Microsoft Fabric only.
- Documents remain in SharePoint/OneDrive and are retrieved through scoped
  Azure AI Search indexes.
- Production secrets belong in Azure Key Vault or approved CI secret stores.

## Required go-live checks

1. Keep `AUTH_DISABLED=false` and `APP_ENV=production`.
2. Replace every `<placeholder>` with a customer-owned resource identifier.
3. Configure exact CORS origins and Entra application audiences.
4. Assign least-privilege Dataverse roles and the read-only Agent Service role.
5. Prove supplier isolation with two independent supplier identities.
6. Enable Defender for Cloud, diagnostic logs, alerting and retention policies.
7. Run SAST, dependency, secret, penetration and recovery testing.
8. Record risk acceptance and production approval through the institution's
   change-management process.
