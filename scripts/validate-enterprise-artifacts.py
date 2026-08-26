from __future__ import annotations
import json
from pathlib import Path
import sys
import yaml

root = Path(__file__).resolve().parents[1]
openapi_path = root / "docs" / "openapi" / "enterprise-controls.yaml"
params_path = root / "infra" / "enterprise-resilience" / "main.parameters.example.json"
api_path = root / "agent-service" / "app" / "enterprise_api.py"

spec = yaml.safe_load(openapi_path.read_text(encoding="utf-8-sig"))
assert spec["openapi"].startswith("3.1")
expected = {
    "/controls/operational-readiness",
    "/controls/fraud/assess",
    "/controls/compliance/assess",
    "/controls/vendors/risk/assess",
    "/controls/payments/milestones/authorize",
}
assert expected <= set(spec["paths"])
api_source = api_path.read_text(encoding="utf-8-sig")
for path in expected:
    route = path.removeprefix("/controls")
    assert route in api_source, f"OpenAPI route missing in implementation: {path}"
params = json.loads(params_path.read_text(encoding="utf-8-sig"))
assert params["parameters"]["primaryLocation"]["value"] != params["parameters"]["secondaryLocation"]["value"]
assert params["parameters"]["minReplicas"]["value"] >= 2
print("Enterprise OpenAPI and parameter artifacts are consistent.")
