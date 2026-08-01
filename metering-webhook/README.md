# FPIP Marketplace Metering Webhook (Phase 3)

Azure Function (Python v2) that receives usage events from the Azure
Marketplace Metering Service and forwards them to the Marketplace Metering API.

## When is this needed?

Only if FPIP is sold through Partner Center/AppSource with **usage-based
metering** (SaaS + custom meter dimensions). If the pricing model is flat-rate
or BYOL, this function is unnecessary.

## Local development

```bash
cd metering-webhook
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
func start
```

Set `METERING_API_TOKEN` for local testing only. In production the function
uses Managed Identity.

## Deployment

```bash
az functionapp create \
  --resource-group <rg> \
  --name <unique-function-app-name> \
  --consumption-plan-location <region> \
  --runtime python \
  --runtime-version 3.11 \
  --functions-version 4 \
  --storage-account <storage-account-name> \
  --os-type Linux

func azure functionapp publish <unique-function-app-name>
```

Register the function URL (`https://<app>.azurewebsites.net/api/MeteringWebhook`)
as the **metering webhook URL** in Partner Center.

## Security

- The incoming request must carry a JWT bearer signed by Microsoft.
- The function verifies the signature against the well-known Microsoft keys,
  validates the audience, and only then forwards the event.
- Production deployments should use Managed Identity to call the Marketplace
  Metering API; local dev falls back to an environment variable.
