# Microsoft Fabric onboarding guide for FPIP customers

This document is for the **bank's Fabric admin**. The FPIP Managed Application
cannot create or own the bank's Fabric workspace — the bank must provision it and
share the workspace resource ID with the FPIP deployment.

## What the bank provides

1. A Microsoft Fabric workspace (F64 capacity or higher recommended for
   Link to Fabric mirroring).
2. The workspace's Azure resource ID, e.g.:
   `/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.Fabric/workspaces/<name>`
3. A service principal or user account with **Contributor** access to the
   workspace, used by the FPIP deployment to enable Dataverse's **Link to
   Microsoft Fabric**.

## What FPIP does during deployment

The Managed Application `mainTemplate.json` stores the workspace resource ID in
`linkedMetadata.fabricWorkspaceId` on the deployed Dataverse environment. After
deployment, an admin must:

1. Open the Power Platform admin center.
2. Select the FPIP environment → **Dataverse → Link to Microsoft Fabric**.
3. Choose the workspace provided above and confirm.
4. Wait for the initial table mirroring to complete.

## What the bank builds on their side (not part of FPIP)

The bank's data engineering team is responsible for:

- Ingesting core-banking transactions into the Fabric Lakehouse via Data Factory,
  Spark notebooks, or shortcuts.
- Creating the SQL analytics endpoint views consumed by the FPIP agent service:
  - `payments`
  - `invoices`
  - `budget_summary`
  - `spend_transactions`

Only the SQL endpoint connection string is stored in FPIP Key Vault. FPIP does
not read the bank's raw Lakehouse files directly.

## Validation

After Link to Fabric is enabled, the FPIP agent service's `fabric_sql_query_tool`
can query the SQL analytics endpoint. Verify with a simple query from the agent
service logs or the Fabric portal.

## Security

- The Fabric SQL endpoint connection string stored in Key Vault should use
  read-only credentials.
- The bank controls all network/firewall rules on the Fabric workspace.
- Microsoft Purview should be configured to capture lineage between Dataverse,
  Fabric, and SharePoint.
