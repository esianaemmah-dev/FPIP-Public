param prefix string
param primaryHostName string
param secondaryHostName string

resource frontDoor 'Microsoft.Cdn/profiles@2024-02-01' = {
  name: '${prefix}-afd'
  location: 'global'
  sku: { name: 'Premium_AzureFrontDoor' }
}
resource endpoint 'Microsoft.Cdn/profiles/afdEndpoints@2024-02-01' = {
  parent: frontDoor
  name: '${prefix}-api'
  location: 'global'
  properties: { enabledState: 'Enabled' }
}
resource originGroup 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  parent: frontDoor
  name: 'active-active'
  properties: {
    healthProbeSettings: {
      probePath: '/ready'
      probeRequestType: 'GET'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 30
    }
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    sessionAffinityState: 'Disabled'
  }
}
resource primaryOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  parent: originGroup
  name: 'primary'
  properties: {
    hostName: primaryHostName
    originHostHeader: primaryHostName
    httpPort: 80
    httpsPort: 443
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}
resource secondaryOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  parent: originGroup
  name: 'secondary'
  properties: {
    hostName: secondaryHostName
    originHostHeader: secondaryHostName
    httpPort: 80
    httpsPort: 443
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}
resource route 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  parent: endpoint
  name: 'api-route'
  dependsOn: [primaryOrigin, secondaryOrigin]
  properties: {
    originGroup: { id: originGroup.id }
    supportedProtocols: ['Https']
    patternsToMatch: ['/*']
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    enabledState: 'Enabled'
  }
}

output frontDoorHostName string = endpoint.properties.hostName
