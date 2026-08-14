<#
.SYNOPSIS
  Provisions the FPIP_Core Dataverse solution (13 tables, optionsets, lookups)
  from the JSON manifests in ./FPIP_Core — no `pac` CLI required.

.DESCRIPTION
  Uses the Dataverse Web API (metadata endpoints: EntityDefinitions,
  RelationshipDefinitions, publishers, solutions) to create the FPIP publisher,
  the FPIP_Core solution, all 11 fpip_* tables, their columns (string, money,
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
    $r = Invoke-DV 'GET' "publishers?`$filter=uniquename eq '$name'&`$select=publisherid"
    if ($r.Body.value.Count -gt 0) { Write-Host "Publisher '$name' exists"; return $r.Body.value[0].publisherid }
  } catch { }
  $body = @{
    uniquename = $name
    friendlyname = $pub.displayName
    customizationprefix = $pub.prefix
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
    $r = Invoke-DV 'GET' "solutions?`$filter=uniquename eq '$name'&`$select=solutionid"
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
  $primaryCol = ($t.columns | Where-Object { $_.name -eq $t.primaryNameAttribute } | Select-Object -First 1)
  if (-not $primaryCol) { throw "Primary column '$($t.primaryNameAttribute)' not found for table '$schema'" }
  $body = @{
    '@odata.type' = '#Microsoft.Dynamics.CRM.EntityMetadata'
    SchemaName = $schema
    DisplayName = (@{ LocalizedLabels = @(@{ Label = $t.displayName; LanguageCode = $LANG }) } | ConvertTo-Json -Depth 5 -Compress | ConvertFrom-Json)
    DisplayCollectionName = (@{ LocalizedLabels = @(@{ Label = $t.displayCollectionName; LanguageCode = $LANG }) } | ConvertTo-Json -Depth 5 -Compress | ConvertFrom-Json)
    Attributes = @(@{
      '@odata.type' = '#Microsoft.Dynamics.CRM.StringAttributeMetadata'
      AttributeType = 'String'
      AttributeTypeName = @{ Value = 'StringType' }
      SchemaName = $t.primaryNameAttribute
      DisplayName = (@{ LocalizedLabels = @(@{ Label = $primaryCol.displayName; LanguageCode = $LANG }) } | ConvertTo-Json -Depth 5 -Compress | ConvertFrom-Json)
      IsPrimaryName = $true
      RequiredLevel = @{ Value = if ($primaryCol.required) { 'SystemRequired' } else { 'None' } }
      MaxLength = if ($primaryCol.maxLength) { [int]$primaryCol.maxLength } else { 100 }
      FormatName = @{ Value = 'Text' }
    })
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

function ConvertTo-Hashtable($obj) {
  if ($null -eq $obj) { return @{} }
  if ($obj -is [hashtable]) { return $obj }
  $ht = @{}
  foreach ($p in $obj.PSObject.Properties) {
    $ht[$p.Name] = $p.Value
  }
  return $ht
}

# ---------------- Column (by type) ----------------
function New-Column([string]$entityId, $colIn) {
  $col = ConvertTo-Hashtable $colIn
  $typeMap = @{
    string = 'StringAttributeMetadata'
    memo = 'MemoAttributeMetadata'
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
    RequiredLevel = @{ Value = if ($col.required) { 'SystemRequired' } else { 'None' } }
  }
  switch ($col.type) {
    'string' { $base['MaxLength'] = if ($col.maxLength) { [int]$col.maxLength } else { 100 }; $base['FormatName'] = @{ Value = 'Text' } }
    'memo' { $base['MaxLength'] = if ($col.maxLength) { [int]$col.maxLength } else { 2000 } }
    'url' { $base['MaxLength'] = if ($col.maxLength) { [int]$col.maxLength } else { 500 }; $base['FormatName'] = @{ Value = 'Url' } }
    'money' { $base['MinValue'] = if ($null -ne $col.min) { $col.min } else { 0 }; $base['MaxValue'] = 922337203685477; $base['Precision'] = if ($col.precision) { [int]$col.precision } else { 2 }; $base['IsBaseCurrency'] = $true }
    'decimal' { $base['MinValue'] = $col.min; $base['MaxValue'] = $col.max; $base['Precision'] = $col.precision }
    'whole' { $base['MinValue'] = $col.min; $base['MaxValue'] = 2147483647; $base['Format'] = 'None' }
    'date' { $base['Format'] = $col.format }
    'datetime' { $base['Format'] = $col.format }
    'boolean' {
      $base['DefaultValue'] = [bool]$col.default
      $base['OptionSet'] = @{
        '@odata.type' = '#Microsoft.Dynamics.CRM.BooleanOptionSetMetadata'
        TrueOption = @{ Value = 1; Label = (ConvertTo-LabelObj 'Yes') }
        FalseOption = @{ Value = 0; Label = (ConvertTo-LabelObj 'No') }
      }
    }
    'choice' {
      $opts = @()
      if ($col.options -is [array]) {
        for ($i = 0; $i -lt $col.options.Count; $i++) {
          $opts += @{ Value = ($i + 1); Label = (ConvertTo-LabelObj ([string]$col.options[$i])) }
        }
      } else {
        $optMap = ConvertTo-Hashtable $col.options
        foreach ($k in $optMap.Keys) {
          $opts += @{ Value = [int]$optMap[$k]; Label = (ConvertTo-LabelObj ([string]$k)) }
        }
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
# Dataverse creates the lookup attribute as part of the relationship definition.
# Creating LookupAttributeMetadata alone is rejected (0x80040203).
function New-Lookup([string]$entityId, $lkIn, [string]$referencingSchema) {
  $lk = ConvertTo-Hashtable $lkIn
  $relSchema = "fpip_$($lk.targetTable)_${referencingSchema}_$($lk.name)"
  $relBody = @{
    '@odata.type' = '#Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata'
    SchemaName = $relSchema
    ReferencedEntity = $lk.targetTable
    ReferencingEntity = $referencingSchema
    Lookup = @{
      '@odata.type' = '#Microsoft.Dynamics.CRM.LookupAttributeMetadata'
      SchemaName = $lk.name
      DisplayName = (ConvertTo-LabelObj $lk.displayName)
      RequiredLevel = @{ Value = if ($lk.required) { 'SystemRequired' } else { 'None' } }
    }
  } | ConvertTo-Json -Depth 8 -Compress
  try {
    Invoke-DV 'POST' 'RelationshipDefinitions' $relBody | Out-Null
    Write-Host "    + lookup $($lk.name) -> $($lk.targetTable)"
  } catch {
    $msg = $_.Exception.Message
    if ($msg -match 'already exists|duplicate|0x8004430d|0x80040237') {
      Write-Host "    = lookup $($lk.name) already exists"
    } else {
      Write-Warning "    ! relationship for $($lk.name) failed: $msg"
    }
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
      columns               = $t.columns
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
    if ($col.name -eq $t.primaryNameAttribute) { continue }
    New-Column $eid $col
  }
  foreach ($lk in $t.lookups) {
    New-Lookup $eid $lk $schema
  }
}

Write-Host ""
Write-Host "FPIP_Core schema provisioned."
Write-Host "Next: publish customizations (pac solution publish or via admin center),"
Write-Host "      then configure the 6 security roles per FPIP_Core/roles.md."
