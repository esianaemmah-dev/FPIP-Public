param location string
param prefix string
param agentImage string
param minReplicas int
param maxReplicas int

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${prefix}-logs-${uniqueString(resourceGroup().id)}'
  location: location
  properties: { retentionInDays: 90 }
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${prefix}-cae-${uniqueString(resourceGroup().id)}'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
    zoneRedundant: true
  }
}

resource api 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-agent-api'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
        allowInsecure: false
      }
    }
    template: {
      containers: [{
        name: 'agent-api'
        image: agentImage
        env: [
          { name: 'APP_ENV', value: 'production' }
          { name: 'DEPLOYMENT_REGION', value: location }
          { name: 'RATE_LIMIT_REQUESTS', value: '120' }
          { name: 'RATE_LIMIT_WINDOW_SECONDS', value: '60' }
        ]
        probes: [
          { type: 'Liveness', httpGet: { path: '/health', port: 8000, scheme: 'HTTP' }, initialDelaySeconds: 10, periodSeconds: 20 }
          { type: 'Readiness', httpGet: { path: '/ready', port: 8000, scheme: 'HTTP' }, initialDelaySeconds: 5, periodSeconds: 10 }
        ]
      }]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [{ name: 'http-concurrency', http: { metadata: { concurrentRequests: '50' } } }]
      }
    }
  }
}

output fqdn string = api.properties.configuration.ingress.fqdn
output principalId string = api.identity.principalId
