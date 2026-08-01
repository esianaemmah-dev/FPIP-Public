<#
.SYNOPSIS
  Run the remaining live-environment steps to finish FPIP deployment.

.DESCRIPTION
  Code and ARM templates are complete. This script walks through the steps that
  require a live Azure / Power Platform / Entra tenant. Run each section in order
  after the previous one succeeds.

  Prerequisites: Azure CLI logged in (`az login`), Contributor on rg-fpip-west,
  Power Platform admin rights, and Entra ID Global Administrator (or App Admin).

.EXAMPLE
  .\scripts\finish-deployment.ps1 -Step Dataverse
  .\scripts\finish-deployment.ps1 -Step All
#>
[CmdletBinding()]
param(
  [ValidateSet('Status', 'Dataverse', 'Entra', 'ProvisionSchema', 'DeployWeb', 'PowerAutomate', 'Verify', 'All')]
  [string] $Step = 'Status',
  [string] $DataverseUrl = ''
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path $PSScriptRoot -Parent

$ResourceGroup = 'rg-fpip-west'
$StaticWebApp = 'fpip-web-qjrir7ktu37ho'
$AgentFqdn = 'fpip-agent-qjrir7ktu37ho.wonderfulglacier-e4dea04f.westus2.azurecontainerapps.io'
$PpEnvId = 'a356101d-706d-ed3a-957f-f5f92e7fd557'
$TenantId = 'dcb0b132-fb9e-475c-a68e-b0671222e8d8'
$DataverseUrlDefault = 'https://org46020af7.crm4.dynamics.com'

function Show-Status {
  Write-Host "`n=== FPIP deployment status ===" -ForegroundColor Cyan

  Write-Host "`n[Azure] Resource group $ResourceGroup"
  az resource list -g $ResourceGroup --query "[].{name:name,type:type}" -o table

  Write-Host "`n[Agent service] https://$AgentFqdn/health"
  try {
    $health = Invoke-RestMethod -Uri "https://$AgentFqdn/health" -TimeoutSec 30
    Write-Host "  status: $($health.status)" -ForegroundColor Green
  } catch {
    Write-Host "  unreachable: $($_.Exception.Message)" -ForegroundColor Red
  }

  Write-Host "`n[Static Web App]"
  $swa = az staticwebapp show -n $StaticWebApp -g $ResourceGroup -o json | ConvertFrom-Json
  Write-Host "  URL: https://$($swa.defaultHostname)"

  Write-Host "`n[Power Platform] FPIP Test environment"
  Write-Host "  Admin: https://admin.powerplatform.microsoft.com/environments/environment/$PpEnvId/hub"
  Write-Host "  Dataverse: $DataverseUrlDefault"
  Write-Host "  Schema FPIP_Core: provisioned (11 tables). Configure security roles next."

  Write-Host "`n[Remaining manual steps]"
  Write-Host '  1. Configure 6 security roles per dataverse/FPIP_Core/roles.md'
  Write-Host '  2. Create Dataverse Application User for FPIP-Agent-Service (see deployment-state.json)'
  Write-Host '  3. Verify Supplier Portal isolation with two test supplier users'
  Write-Host '  4. Import Power Automate flows from power-automate/'
  Write-Host '  5. Fabric link, SharePoint doc management, Purview (see docs/)'
  Write-Host '  6. Open SPA and sign in: https://nice-bush-07eb2591e.7.azurestaticapps.net'
}

function Ensure-DataverseDatabase {
  Write-Host "`n=== Step: Add Dataverse database ===" -ForegroundColor Cyan
  Write-Host ''
  Write-Host 'Open the Power Platform admin center and add a database to the FPIP Test environment:'
  Write-Host "  https://admin.powerplatform.com/environments/environment/$PpEnvId/hub"
  Write-Host ''
  Write-Host '  1. Select the environment, then Add database'
  Write-Host '  2. Choose region: North Europe (matches your environment)'
  Write-Host '  3. Enable Dynamics 365 apps if prompted (not required for custom tables)'
  Write-Host '  4. Note the environment URL, e.g. https://orgXXXXXXXX.crm4.dynamics.com'
  Write-Host ''
  Write-Host 'Re-run with -Step ProvisionSchema once you have the URL.'
}

function Invoke-ProvisionSchema {
  param([Parameter(Mandatory)][string] $DataverseUrl)

  Write-Host "`n=== Step: Provision FPIP_Core schema ===" -ForegroundColor Cyan
  $token = az account get-access-token --resource $DataverseUrl --query accessToken -o tsv
  if (-not $token) { throw "Failed to acquire Dataverse token for $DataverseUrl" }

  & (Join-Path $RepoRoot 'dataverse\provision-FpipCore.ps1') `
    -DataverseUrl $DataverseUrl `
    -AccessToken $token

  Write-Host "`nPublish customizations in the Power Platform admin center, then configure security roles."
}

function Invoke-DeployWeb {
  Write-Host "`n=== Step: Deploy React app to Static Web App ===" -ForegroundColor Cyan
  Push-Location (Join-Path $RepoRoot 'app')
  try {
    if (-not (Test-Path 'dist/index.html')) {
      Write-Host "Building production bundle..."
      npm run build
    }
    $token = az staticwebapp secrets list -n $StaticWebApp -g $ResourceGroup --query "properties.apiKey" -o tsv
    if (-not $token) { throw "Could not retrieve Static Web App deployment token" }
    npx --yes @azure/static-web-apps-cli deploy ./dist --deployment-token $token --env production
  } finally {
    Pop-Location
  }
}

switch ($Step) {
  'Status' { Show-Status }
  'Dataverse' { Ensure-DataverseDatabase }
  'ProvisionSchema' {
    if (-not $DataverseUrl) {
      throw "Pass -DataverseUrl https://<org>.crm.dynamics.com after adding the database."
    }
    Invoke-ProvisionSchema -DataverseUrl $DataverseUrl
  }
  'DeployWeb' { Invoke-DeployWeb }
  'Entra' {
    Write-Host "Run: .\entra\create-FpipAppRegistrations.ps1"
    Write-Host "Then grant admin consent and copy client IDs into app/.env.local"
  }
  'PowerAutomate' {
    Write-Host "Import the four JSON flows from power-automate/ via make.powerautomate.com"
    Write-Host "Configure approver UPNs using fpip_approvalpolicy records in Dataverse."
  }
  'Verify' {
    Write-Host "Supplier isolation test checklist:"
    Write-Host "  - Create two supplier users with FPIP Supplier Portal User role"
    Write-Host "  - Confirm each sees only their own bids/invoices/documents"
    Write-Host "  - Confirm agent service filters by supplier_id when role=supplier"
  }
  'All' {
    Show-Status
    Ensure-DataverseDatabase
    Write-Host "`nComplete remaining steps manually after Dataverse URL is available."
  }
}
