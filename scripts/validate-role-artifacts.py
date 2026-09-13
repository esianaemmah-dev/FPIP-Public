"""Assert the FPIP role list agrees across every layer that defines it.

The React SPA calls Dataverse directly with the user's delegated token, so a role
the UI offers but Dataverse does not define fails open into an empty screen or a
403 rather than a build error. This script makes that drift a CI failure.
"""
from __future__ import annotations
import json
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]


def read(*parts: str) -> str:
    return root.joinpath(*parts).read_text(encoding="utf-8-sig")


def quoted(block: str) -> set[str]:
    return set(re.findall(r"['\"]([a-z_]+)['\"]", block))


def between(source: str, start: str, end: str, label: str) -> str:
    match = re.search(re.escape(start) + r"(.*?)" + re.escape(end), source, re.S)
    assert match, f"Could not locate the {label} block — did its formatting change?"
    return match.group(1)


# Canonical snake_case role IDs, as five layers spell them.
security_roles = quoted(
    between(read("agent-service", "app", "security.py"), "_ROLE_NAMES = {", "}", "_ROLE_NAMES")
)
frontend_roles = quoted(
    between(read("app", "src", "lib", "entraRoles.ts"), "return [", "]", "isRoleId")
)
group_map_roles = set(json.loads(read("entra", "group-role-map.json")).values())
# The deployed SPA resolves group-ID claims through this env var, not the JSON above,
# so it is the layer where drift actually reaches production.
env_map_roles = set(
    json.loads(
        between(read("app", ".env.production"), "VITE_ENTRA_GROUP_MAP=", "\n", "VITE_ENTRA_GROUP_MAP")
    ).values()
)
entra_script_roles = set(
    re.findall(r"Role\s*=\s*'([a-z_]+)'", read("entra", "create-FpipSecurityGroups.ps1"))
)

# security.py is the baseline every other layer is compared against, so a parse that
# silently under-matches would invert the whole check — pin the roles that predate it.
_ANCHORS = {"admin", "executive", "procurement", "finance", "auditor", "supplier"}
assert _ANCHORS <= security_roles, (
    f"_ROLE_NAMES parsed as {sorted(security_roles)}, which is missing "
    f"{sorted(_ANCHORS - security_roles)} — the regex likely stopped matching. "
    "Note role IDs must stay [a-z_] to be parsed here."
)

layers = {
    "agent-service/app/security.py (_ROLE_NAMES)": security_roles,
    "app/src/lib/entraRoles.ts (isRoleId)": frontend_roles,
    "entra/group-role-map.json (values)": group_map_roles,
    "app/.env.production (VITE_ENTRA_GROUP_MAP)": env_map_roles,
    "entra/create-FpipSecurityGroups.ps1 (Role =)": entra_script_roles,
}
for label, roles in layers.items():
    assert roles == security_roles, (
        f"Role drift in {label}: "
        f"missing {sorted(security_roles - roles)}, extra {sorted(roles - security_roles)}"
    )

# dataverse/FPIP_Core/solution.json spells roles as display names ("FPIP Budget Owner").
_ALIASES = {"supplier_portal_user": "supplier"}
_SERVICE_PRINCIPAL = "agent_service"  # not a user role, so absent from _ROLE_NAMES by design
_PLATFORM_ROLE = "admin"  # backed by the built-in System Administrator, so absent from solution.json

solution_names = [role["name"] for role in json.loads(read("dataverse", "FPIP_Core", "solution.json"))["securityRoles"]]
normalized = {
    _ALIASES.get(name, name)
    for name in (n.removeprefix("FPIP ").lower().replace(" ", "_") for n in solution_names)
}

assert _SERVICE_PRINCIPAL in normalized, "solution.json must still define the FPIP Agent Service role"
assert _SERVICE_PRINCIPAL not in security_roles, "Agent Service is a service principal, not a user role"
assert _PLATFORM_ROLE not in normalized, (
    "FPIP Admin must stay out of solution.json — platform admin uses the built-in "
    "System Administrator role (see dataverse/FPIP_Core/roles.md)"
)

expected = (security_roles - {_PLATFORM_ROLE}) | {_SERVICE_PRINCIPAL}
assert normalized == expected, (
    "Role drift in dataverse/FPIP_Core/solution.json (securityRoles): "
    f"missing {sorted(expected - normalized)}, extra {sorted(normalized - expected)}"
)

print(f"Role artifacts are consistent across 6 layers ({len(security_roles)} user roles).")
