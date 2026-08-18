# FPIP Disaster-Recovery Runbook

## Scope

Recover the React frontend, agent API, Dataverse operational records, Cosmos checkpoints, Fabric analytics access, SharePoint evidence links, Key Vault secrets and immutable audit export without bypassing segregation of duties.

## Activation

1. Incident commander declares severity and freezes non-essential releases.
2. Confirm Front Door health, regional Container App health and dependency telemetry.
3. Classify regional failure, identity failure, data corruption, provider outage or security incident.
4. Preserve logs and audit evidence before remediation.

## Regional failover

1. Remove the unhealthy origin from Azure Front Door only after health evidence.
2. Confirm secondary-region API readiness, Entra token validation and Key Vault access.
3. Verify Cosmos checkpoint and Dataverse availability; never replay events without idempotency keys.
4. Run read-only smoke tests, then one controlled write with an authorized test identity.
5. Record decision, actor, timestamps, evidence hashes and customer notification.

## Data recovery

- Restore into an isolated recovery environment first.
- Reconcile counts, hashes, newest timestamps and referential integrity.
- Obtain data owner and security approval before production cutover.
- Never overwrite immutable audit exports; create a linked correction record.

## Return to service

Gradually restore traffic, monitor saturation/error/latency signals, reconcile queued events and produce a post-incident review within two business days. Run this procedure quarterly in the tenant before claiming the RTO/RPO objectives.
