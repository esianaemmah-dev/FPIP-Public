<#
.SYNOPSIS
  Create FPIP Entra security groups and emit VITE_ENTRA_GROUP_MAP JSON.

.DESCRIPTION
  Creates (or reuses) department security groups used by the SPA for RBAC.
  Requires Azure CLI (`az login`) with Group.ReadWrite.All or Directory rights.

.EXAMPLE
  .\entra\create-FpipSecurityGroups.ps1
#>
[CmdletBinding()]
param(
  [string] $OutFile = (Join-Path $PSScriptRoot 'group-role-map.json')
)

$ErrorActionPreference = 'Stop'

$groups = @(
  @{ Name = 'FPIP-Platform-Admin'; Mail = 'fpip-platform-admin'; Role = 'admin'; Description = 'FPIP platform administrators' }
  @{ Name = 'FPIP-Executive'; Mail = 'fpip-executive'; Role = 'executive'; Description = 'FPIP executive dashboard users' }
  @{ Name = 'FPIP-Procurement'; Mail = 'fpip-procurement'; Role = 'procurement'; Description = 'FPIP procurement department' }
  @{ Name = 'FPIP-Finance'; Mail = 'fpip-finance'; Role = 'finance'; Description = 'FPIP finance department' }
  @{ Name = 'FPIP-Auditor'; Mail = 'fpip-auditor'; Role = 'auditor'; Description = 'FPIP auditors (read-only)' }
  @{ Name = 'FPIP-Supplier'; Mail = 'fpip-supplier'; Role = 'supplier'; Description = 'FPIP supplier portal users' }
  @{ Name = 'FPIP-HOD'; Mail = 'fpip-hod'; Role = 'hod'; Description = 'Heads of department — requisition intake' }
  @{ Name = 'FPIP-Budget-Owner'; Mail = 'fpip-budget-owner'; Role = 'budget_owner'; Description = 'Budget envelope owners' }
  @{ Name = 'FPIP-Contract-Manager'; Mail = 'fpip-contract-manager'; Role = 'contract_manager'; Description = 'Contract portfolio and renewals' }
)

$map = [ordered]@{}

foreach ($g in $groups) {
  $existing = az ad group list --query "[?displayName=='$($g.Name)'].id" -o tsv
  if ($existing) {
    $id = ($existing -split "`n" | Where-Object { $_ } | Select-Object -First 1).Trim()
    Write-Host "Exists: $($g.Name) -> $id"
  } else {
    Write-Host "Creating $($g.Name)..."
    $created = az ad group create `
      --display-name $g.Name `
      --mail-nickname $g.Mail `
      --description $g.Description `
      -o json | ConvertFrom-Json
    $id = $created.id
    Write-Host "Created: $($g.Name) -> $id"
  }
  $map[$id] = $g.Role
}

$json = ($map | ConvertTo-Json -Compress)
Set-Content -Path $OutFile -Value ($map | ConvertTo-Json) -Encoding utf8

Write-Host ''
Write-Host '=== Add to app/.env.production (and rebuild) ===' -ForegroundColor Cyan
Write-Host "VITE_ENTRA_GROUP_MAP=$json"
Write-Host ''
Write-Host "Also ensure the SPA app registration requests optional claim 'groups',"
Write-Host "or assign users to these groups and emit group Object IDs in the ID token."
Write-Host "Map written to: $OutFile"
