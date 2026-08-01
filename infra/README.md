# FPIP Infrastructure — Managed Application packaging (Phases 1–3)

This folder contains the Azure Managed Application packaging files. FPIP ships as an **Azure Managed Application**: the resources deploy into the customer's own Azure subscription/tenant.

## Files

| File | Purpose |
|---|---|
| `mainTemplate.json` | ARM template — the contents of the managed resource group. Includes Dataverse environment, Key Vault, Static Web App, Log Analytics, Application Insights, Container Apps environment + real agent service container, and an optional Metering webhook Function App. |
| `createUiDefinition.json` | Partner Center install-time UI. Collects region, Dataverse environment name, Fabric workspace ID, plan tier, Static Web App SKU, container image override, and whether to deploy the metering webhook. |
| `viewDefinition.json` | Post-install management view shown to the publisher in the Azure Portal (Overview / Metrics / Dataverse environment). |

## What deploys where (Managed Application model)

```
Customer subscription (managed resource group)
├── Microsoft.PowerPlatform/environments   → Dataverse (FPIP_Core solution)
├── Microsoft.KeyVault/vaults              → secrets for the agent service
├── Microsoft.Web/staticSites              → React SPA (this /app, Vite build)
├── Microsoft.App/managedEnvironments      → Container Apps environment
├── Microsoft.App/containerApps            → LangGraph agent service
├── Microsoft.OperationalInsights/workspaces → Log Analytics
├── Microsoft.Insights/components          → Application Insights
└── Microsoft.Web/sites                    → Marketplace metering webhook (optional)
```

## Validate locally

```powershell
az login
az extension add --name managedapp   # if not already installed

# Validate the ARM template against a clean test resource group.
az deployment group validate `
  --resource-group fpip-validate-test `
  --template-file infra/mainTemplate.json `
  --parameters location=eastus environmentName="FPIP validate" fabricWorkspaceId="/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg/providers/Microsoft.Fabric/workspaces/ws" planTier=Standard publisherTenantId=00000000-0000-0000-0000-000000000000 staticWebAppSku=Standard deployMeteringWebhook=false

# Validate the createUiDefinition (Partner Center publish-time check).
az managedapp create-ui-definition validate --create-ui-definition infra/createUiDefinition.json
```

## Post-deployment manual steps

1. Provision the FPIP_Core solution into the deployed Dataverse environment using `dataverse/provision-FpipCore.ps1`.
2. Create the three Entra app registrations using `entra/create-FpipAppRegistrations.ps1` and grant admin consent.
3. Add the FPIP-Agent-Service service principal as a Dataverse Application User and assign the `FPIP Agent Service` role.
4. Populate Key Vault secrets referenced by `agent-service/app/config.py`.
5. Grant the Container App Managed Identity: Key Vault Secrets User, Azure OpenAI User, Azure AI Search Index Data Reader, and (if used) Cosmos DB Built-in Data Contributor.
6. Configure SharePoint document management on `fpip_compliancedocument`, `fpip_contract`, and `fpip_supplier`.
7. Import the four Power Automate flows from `power-automate/` and configure approver UPNs/team names.
8. Enable Dataverse auditing and link Microsoft Purview.
9. Register the metering webhook URL in Partner Center if usage-based billing is enabled.

Publishing to Partner Center / AppSource is the final marketplace submission step — prepare listing assets (description, screenshots, support contact) after the package validates.

