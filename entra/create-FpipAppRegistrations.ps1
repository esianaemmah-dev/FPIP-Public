#requires -Version 7
<#
.SYNOPSIS
  Creates the Entra ID app registrations for FPIP Phases 1 and 2:
  FPIP-Web-SPA, FPIP-Supplier-External, and FPIP-Agent-Service.

.DESCRIPTION
  Uses the Microsoft Graph PowerShell SDK to create the two SPA registrations
  (Phase 1) plus the confidential client used by the Phase 2 LangGraph agent
  service. The agent-service registration is granted an application permission
  (app role) on Dynamics CRM / Dataverse for app-only service-principal access.

.NOTES
  The Microsoft Graph PowerShell SDK is NOT installed in this dev environment,
  so this script was not executed here. Run it from a machine with:
    Install-Module Microsoft.Graph.Authentication -Scope CurrentUser
    Install-Module Microsoft.Graph.Applications    -Scope CurrentUser

  The Dynamics CRM / Dataverse resource app id (00000007-0000-0ff1-ce00-000000000000)
  is well-known and stable. The delegated and application permission GUIDs can
  vary by tenant — VERIFY them in the Entra admin center and run admin consent.
#>
[CmdletBinding()]
param(
  [string]$SupplierAuthority = 'https://login.microsoftonline.com/<external-id-tenant>',
  # Dynamics CRM / Dataverse well-known resource app id.
  [string]$DynamicsResourceAppId = '00000007-0000-0ff1-ce00-000000000000',
  # VERIFY this GUID in your tenant — Dynamics CRM user_impersonation (delegated).
  [string]$DynamicsUserImpersonationId = '74679d18-5a85-4dba-bfe1-8a2c21a0c7da',
  # VERIFY this GUID in your tenant — Dynamics CRM user_impersonation (application / app role).
  [string]$DynamicsUserImpersonationAppRoleId = '58bf87bf-79b5-49ed-b50c-7050c5e7446b'
)

$ErrorActionPreference = 'Stop'

function New-FpipSpaApp {
  param(
    [string]$DisplayName,
    [string[]]$RedirectUris,
    [string]$SignInAudience = 'AzureADMyOrg'
  )
  $spa = @{ RedirectUris = $RedirectUris }
  $requiredAccess = @(
    @{
      ResourceAppId = $DynamicsResourceAppId
      ResourceAccess = @(@{ Id = $DynamicsUserImpersonationId; Type = 'Scope' })
    }
  )
  $params = @{
    DisplayName            = $DisplayName
    SignInAudience         = $SignInAudience
    Spa                    = $spa
    RequiredResourceAccess = $requiredAccess
  }
  $app = New-MgApplication @params
  $sp = New-MgServicePrincipal -AppId $app.AppId -DisplayName $DisplayName
  Write-Host ("Created SPA app: {0}" -f $DisplayName)
  Write-Host ("  Client ID:     {0}" -f $app.AppId)
  Write-Host ("  Object ID:     {0}" -f $app.Id)
  return [pscustomobject]@{ App = $app; ServicePrincipal = $sp }
}

function New-FpipConfidentialApp {
  param([string]$DisplayName)
  $requiredAccess = @(
    @{
      ResourceAppId  = $DynamicsResourceAppId
      ResourceAccess = @(@{ Id = $DynamicsUserImpersonationAppRoleId; Type = 'Role' })
    }
  )
  $app = New-MgApplication -DisplayName $DisplayName -SignInAudience 'AzureADMyOrg' -RequiredResourceAccess $requiredAccess
  $sp = New-MgServicePrincipal -AppId $app.AppId -DisplayName $DisplayName
  $password = Add-MgApplicationPassword -ApplicationId $app.Id -PasswordCredential @{ DisplayName = 'FPIP-Agent-Service secret' }
  Write-Host ("Created confidential app: {0}" -f $DisplayName)
  Write-Host ("  Client ID:     {0}" -f $app.AppId)
  Write-Host ("  Object ID:     {0}" -f $app.Id)
  Write-Host ("  Secret:        {0}" -f $password.SecretText)
  return [pscustomobject]@{ App = $app; ServicePrincipal = $sp; Secret = $password }
}

# ---------------- Connect ----------------
Write-Host "Connecting to Microsoft Graph (needs Application.ReadWrite.All)..."
Connect-MgGraph -Scopes 'Application.ReadWrite.All'

# ---------------- 1. FPIP-Web-SPA (internal staff) ----------------
$web = New-FpipSpaApp -DisplayName 'FPIP-Web-SPA' -RedirectUris @('http://localhost:5173/') -SignInAudience 'AzureADMyOrg'

# ---------------- 2. FPIP-Supplier-External (Supplier Portal) ----------------
$supplier = New-FpipSpaApp -DisplayName 'FPIP-Supplier-External' -RedirectUris @('http://localhost:5173/') -SignInAudience 'AzureADMultipleOrgs'

# ---------------- 3. FPIP-Agent-Service (Phase 2 backend) ----------------
$agentService = New-FpipConfidentialApp -DisplayName 'FPIP-Agent-Service'

# ---------------- Output wiring instructions ----------------
Write-Host ""
Write-Host "=== Wire into app/.env.local (React SPA) ==="
Write-Host "VITE_AAD_CLIENT_ID=$($web.App.AppId)"
Write-Host "VITE_AAD_TENANT_ID=<your-tenant-id>"
Write-Host "VITE_AAD_AUTHORITY=https://login.microsoftonline.com/<your-tenant-id>"
Write-Host "VITE_DATAVERSE_URL=https://<env>.crm.dynamics.com"
Write-Host ""
Write-Host "Supplier Portal build:"
Write-Host "VITE_AAD_CLIENT_ID=$($supplier.App.AppId)"
Write-Host "VITE_AAD_AUTHORITY=$SupplierAuthority"
Write-Host ""
Write-Host "=== Store in Key Vault for agent-service (agent-service/.env or KV) ==="
Write-Host "dataverse-client-id=$($agentService.App.AppId)"
Write-Host "dataverse-client-secret=$($agentService.Secret.SecretText)"
Write-Host "dataverse-tenant-id=<your-tenant-id>"
Write-Host "dataverse-url=https://<env>.crm.dynamics.com"
Write-Host ""
Write-Host "NEXT: grant admin consent for Dataverse permissions on all three apps"
Write-Host "      (Entra > App registrations > API permissions > Grant admin consent)."
Write-Host "      Verify the delegated and app-role GUIDs above if consent fails."
Write-Host "      Then create a Dataverse Application User for the FPIP-Agent-Service"
Write-Host "      service principal and assign it the 'FPIP Auditor' or custom read role."

