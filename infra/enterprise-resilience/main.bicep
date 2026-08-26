targetScope = 'subscription'

@description('Globally unique lowercase prefix, 3-16 characters.')
param prefix string
param primaryLocation string = 'eastus2'
param secondaryLocation string = 'westus3'
param agentImage string
param minReplicas int = 2
param maxReplicas int = 20

resource primaryRg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: '${prefix}-primary-rg'
  location: primaryLocation
}
resource secondaryRg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: '${prefix}-secondary-rg'
  location: secondaryLocation
}
resource globalRg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: '${prefix}-global-rg'
  location: primaryLocation
}

module primary 'regional.bicep' = {
  name: 'primary-region'
  scope: primaryRg
  params: {
    location: primaryLocation
    prefix: prefix
    agentImage: agentImage
    minReplicas: minReplicas
    maxReplicas: maxReplicas
  }
}
module secondary 'regional.bicep' = {
  name: 'secondary-region'
  scope: secondaryRg
  params: {
    location: secondaryLocation
    prefix: prefix
    agentImage: agentImage
    minReplicas: minReplicas
    maxReplicas: maxReplicas
  }
}
module global 'global.bicep' = {
  name: 'global-front-door'
  scope: globalRg
  params: {
    prefix: prefix
    primaryHostName: primary.outputs.fqdn
    secondaryHostName: secondary.outputs.fqdn
  }
}

output frontDoorHostName string = global.outputs.frontDoorHostName
output primaryApiHost string = primary.outputs.fqdn
output secondaryApiHost string = secondary.outputs.fqdn
