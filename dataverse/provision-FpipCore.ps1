#requires -Version 7
<#
.SYNOPSIS
  Provisions the FPIP_Core Dataverse solution (10 tables, optionsets, lookups)
  from the JSON manifests in ./FPIP_Core — no `pac` CLI required.

.DESCRIPTION
  Uses the Dataverse Web API (metadata endpoints: EntityDefinitions,
  RelationshipDefinitions, publishers, solutions) to create the FPIP publisher,
  the FPIP_Core solution, all 10 fpip_* tables, their columns (string, money,
  decimal, whole, datetime, boolean, choice, autonumber, url) and their lookup
  relationships.

  This is the no-`pac` alternative. It needs only an Entra ID access token with
  System Customizer rights on the target environment.

.PARAMETER DataverseUrl
  Base URL of the Dataverse environment, e.g. https://contoso.crm.dynamics.com

.PARAMETER AccessToken
  Entra ID bearer token with Dataverse access (System Customizer).

.EXAMPLE
  $token = (az account get-access-token --resource https://contoso.crm.dynamics.com --query accessToken -o tsv)
  .\provision-FpipCore.ps1 -DataverseUrl "https://contoso.crm.dynamics.com" -AccessToken $token

.NOTES
  Not run in this dev environment (no live Dataverse / token available). Validate
  against a sandbox environment first. The schema JSON manifests are the source
  of truth; this script is the executor.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string] $DataverseUrl,
  [Parameter(Mandatory)][string] $AccessToken
)

$ErrorActionPreference = 'Stop'
$baseUrl = $DataverseUrl.TrimEnd('/') + '/api/data/v9.2'
$schemaRoot = Join-Path $PSScriptRoot 'FPIP_Core'
$LANG = 1033 # en-US

function New-Label([string]$text) {
  return @{
    '@odata.type' = '#Microsoft.Dynamics.CRM.Label'
    LocalizedLabels = @(@{ '@odata.type' = '#Microsoft.Dynamics.CRM.LocalizedLabel'; Label = $text; LanguageCode = $LANG })
  } | ConvertTo-Json -Depth 5 -Compress
}

function Invoke-DV([string]$method, [string]$path, [string]$body = $null) {
  $url = "$baseUrl/$path"
  $headers = @{
    Authorization = "Bearer $AccessToken"
    Accept = 'application/json'
    'OData-MaxVersion' = '4.0'
    'OData-Version' = '4.0'
  }
  if ($body) {
    $headers['Content-Type'] = 'application/json'
    $resp = Invoke-WebRequest -Method $method -Uri $url -Headers $headers -Body $body -UseBasicParsing
  } else {
    $resp = Invoke-WebRequest -Method $method -Uri $url -Headers $headers -UseBasicParsing
  }
  $obj = if ($resp.Content) { $resp.Content | ConvertFrom-Json } else { $null }
  $id = $resp.Headers['OData-EntityId']
  return [pscustomobject]@{ Response = $resp; Body = $obj; EntityId = $id }
}

function Get-EntityId([string]$schemaName) {
  $r = Invoke-DV 'GET' "EntityDefinitions(LogicalName='$schemaName')?`$select=MetadataId"
  return $r.Body.MetadataId
}

# ---------------- Publisher ----------------
function Ensure-Publisher([hashtable]$pub) {
  $name = $pub.uniqueName
  try {
    $r = Invoke-DV 'GET' "publishers(`$filter=uniquename eq '$name')?`$select=publisherid"
    if ($r.Body.value.Count -gt 0) { Write-Host "Publisher '$name' exists"; return $r.Body.value[0].publisherid }
  } catch { }
  $body = @{
    uniquename = $name
    publishername = $pub.displayName
    customizationprefix = $pub.prefix
    customizationoptionsetprefix = 10001
  } | ConvertTo-Json -Compress
  $r = Invoke-DV 'POST' 'publishers' $body
  $id = ($r.EntityId -split "[()]")[1]
  Write-Host "Created publisher '$name' ($id)"
  return $id
}

# ---------------- Solution ----------------
function Ensure-Solution([hashtable]$sol, [string]$publisherId) {
  $name = $sol.uniqueName
  try {
    $r = Invoke-DV 'GET' "solutions(`$filter=uniquename eq '$name')?`$select=solutionid"
    if ($r.Body.value.Count -gt 0) { Write-Host "Solution '$name' exists"; return $r.Body.value[0].solutionid }
  } catch { }
  $body = @{
    uniquename = $name
    friendlyname = $sol.displayName
    description = $sol.description
    version = $sol.version
    'publisherid@odata.bind' = "/publishers($publisherId)"
  } | ConvertTo-Json -Compress
  $r = Invoke-DV 'POST' 'solutions' $body
  $id = ($r.EntityId -split "[()]")[1]
  Write-Host "Created solution '$name' ($id)"
  return $id
}

# ---------------- Table ----------------
function New-Table([hashtable]$t) {
  $schema = $t.logicalName
  $body = @{
    '@odata.type' = '#Microsoft.Dynamics.CRM.EntityMetadata'
    SchemaName = $schema
    DisplayName = (@{ LocalizedLabels = @(@{ Label = $t.displayName; LanguageCode = $LANG }) } | ConvertTo-Json -Depth 5 -Compress | ConvertFrom-Json)
    DisplayCollectionName = (@{ LocalizedLabels = @(@{ Label = $t.displayCollectionName; LanguageCode = $LANG }) } | ConvertTo-Json -Depth 5 -Compress | ConvertFrom-Json)
    PrimaryNameAttribute = $t.primaryNameAttribute
    OwnershipType = 'UserOwned'
    IsActivity = $false
    HasNotes = $false
    HasActivities = $false
  } | ConvertTo-Json -Depth 6 -Compress
  $r = Invoke-DV 'POST' 'EntityDefinitions' $body
  $id = ($r.EntityId -split "[()]")[1]
  Write-Host "  Created table $schema ($id)"
  return $id
}

function ConvertTo-LabelObj([string]$text) {
  return @{ LocalizedLabels = @(@{ Label = $text; LanguageCode = $LANG }) }
}

# ---------------- Column (by type) ----------------
function New-Column([string]$entityId, [hashtable]$col) {
  $typeMap = @{
    string = 'StringAttributeMetadata'
    url = 'StringAttributeMetadata'
    money = 'MoneyAttributeMetadata'
    decimal = 'DecimalAttributeMetadata'
    whole = 'IntegerAttributeMetadata'
    date = 'DateTimeAttributeMetadata'
    datetime = 'DateTimeAttributeMetadata'
    boolean = 'BooleanAttributeMetadata'
    choice = 'PicklistAttributeMetadata'
    autonumber = 'AutoNumberAttributeMetadata'
  }
  $odata = $typeMap[$col.type]
  $base = [ordered]@{
    '@odata.type' = "#Microsoft.Dynamics.CRM.$odata"
    SchemaName = $col.name
    DisplayName = (ConvertTo-LabelObj $col.displayName)
    RequiredLevel = if ($col.required) { 'SystemRequired' } else { 'None' }
  }
  switch ($col.type) {
    'string' { $base['MaxLength'] = $col.maxLength; $base['Format'] = 'Text' }
    'url' { $base['MaxLength'] = $col.maxLength; $base['Format'] = 'Url' }
    'money' { $base['MinValue'] = $col.min; $base['MaxValue'] = 922337203685477; $base['Precision'] = $col.precision; $base['IsBaseCurrency'] = $true }
    'decimal' { $base['MinValue'] = $col.min; $base['MaxValue'] = $col.max; $base['Precision'] = $col.precision }
    'whole' { $base['MinValue'] = $col.min; $base['MaxValue'] = 2147483647; $base['Format'] = 'None' }
    'date' { $base['Format'] = $col.format }
    'datetime' { $base['Format'] = $col.format }
    'boolean' {
      $base['DefaultValue'] = $col.default
      $base['OptionSet'] = @{ '@odata.type' = '#Microsoft.Dynamics.CRM.BooleanOptionSetMetadata'; TrueOption = @{ Value = $true; Label = (ConvertTo-LabelObj 'Yes') }; FalseOption = @{ Value = $false; Label = (ConvertTo-LabelObj 'No') } }
    }
    'choice' {
      $opts = @()
      foreach ($k in $col.options.Keys) {
        $opts += @{ Value = [int]$col.options[$k]; Label = (ConvertTo-LabelObj $k) }
      }
      $base['OptionSet'] = @{ '@odata.type' = '#Microsoft.Dynamics.CRM.OptionSetMetadata'; Options = $opts; IsGlobal = $false }
      if ($col.default) { $base['DefaultFormValue'] = [int]$col.default }
    }
    'autonumber' { $base['Formula'] = $col.format }
  }
  $body = $base | ConvertTo-Json -Depth 6 -Compress
  try {
    Invoke-DV 'POST' "EntityDefinitions($entityId)/Attributes" $body | Out-Null
    Write-Host "    + column $($col.name) [$($col.type)]"
  } catch {
    Write-Warning "    ! column $($col.name) failed: $($_.Exception.Message)"
  }
}

# ---------------- Lookup + relationship ----------------
function New-Lookup([string]$entityId, [hashtable]$lk, [string]$referencingSchema) {
  $attrBody = @{
    '@odata.type' = '#Microsoft.Dynamics.CRM.LookupAttributeMetadata'
    SchemaName = $lk.name
    DisplayName = (ConvertTo-LabelObj $lk.displayName)
    RequiredLevel = if ($lk.required) { 'SystemRequired' } else { 'None' }
  } | ConvertTo-Json -Depth 6 -Compress
  $r = Invoke-DV 'POST' "EntityDefinitions($entityId)/Attributes" $attrBody
  $relSchema = "fpip_$($lk.targetTable)_${referencingSchema}_$($lk.name)"
  $relBody = @{
    '@odata.type' = '#Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata'
    SchemaName = $relSchema
    ReferencedEntity = $lk.targetTable
    ReferencingEntity = $referencingSchema
    LookupAttributeSchemaName = $lk.name
  } | ConvertTo-Json -Depth 6 -Compress
  try {
    Invoke-DV 'POST' 'RelationshipDefinitions' $relBody | Out-Null
    Write-Host "    + lookup $($lk.name) -> $($lk.targetTable)"
  } catch {
    Write-Warning "    ! relationship for $($lk.name) failed: $($_.Exception.Message)"
  }
}

# ---------------- Main ----------------
$solutionDef = Get-Content (Join-Path $schemaRoot 'solution.json') -Raw | ConvertFrom-Json
Write-Host "Provisioning FPIP_Core against $baseUrl"

$publisherId = Ensure-Publisher ([hashtable]@{
  uniqueName  = $solutionDef.solution.publisher.uniqueName
  displayName = $solutionDef.solution.publisher.displayName
  prefix      = $solutionDef.solution.publisher.prefix
})
$solutionId = Ensure-Solution ([hashtable]@{
  uniqueName  = $solutionDef.solution.uniqueName
  displayName = $solutionDef.solution.displayName
  description = $solutionDef.solution.description
  version     = $solutionDef.solution.version
}) $publisherId

# Two passes: tables first (so lookup targets exist), then columns + lookups.
$tableIds = @{}
Write-Host "Pass 1: creating tables"
foreach ($tref in $solutionDef.tables) {
  $t = Get-Content (Join-Path $schemaRoot $tref.file) -Raw | ConvertFrom-Json
  $schema = $t.logicalName
  $existing = $null
  try { $existing = Get-EntityId $schema } catch { }
  if ($existing) {
    Write-Host "  Table $schema exists ($existing)"
    $tableIds[$schema] = $existing
  } else {
    $tableIds[$schema] = New-Table ([hashtable]@{
      logicalName           = $t.logicalName
      displayName           = $t.displayName
      displayCollectionName = $t.displayCollectionName
      primaryNameAttribute  = $t.primaryNameAttribute
    })
  }
}

Write-Host "Pass 2: columns + lookups"
foreach ($tref in $solutionDef.tables) {
  $t = Get-Content (Join-Path $schemaRoot $tref.file) -Raw | ConvertFrom-Json
  $schema = $t.logicalName
  $eid = $tableIds[$schema]
  Write-Host "  $schema"
  foreach ($col in $t.columns) {
    New-Column $eid ([hashtable]$col)
  }
  foreach ($lk in $t.lookups) {
    New-Lookup $eid ([hashtable]$lk) $schema
  }
}

Write-Host ""
Write-Host "FPIP_Core schema provisioned."
Write-Host "Next: publish customizations (pac solution publish or via admin center),"
Write-Host "      then configure the 6 security roles per FPIP_Core/roles.md."
