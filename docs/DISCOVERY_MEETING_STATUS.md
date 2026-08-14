# FPIP Discovery Meeting — delivery status (pre next meeting)

Mapped from the 11 Jul 2026 discovery notes. Demo with `?demo=1` or role picker.

| # | Action | Status in app | Where |
|---|--------|---------------|--------|
| 1 | HOD → FPIP requisition process | **Shipped** (documented steps) | `/hod` |
| 2 | Auto-populating bank requisition form | **Shipped** | `/hod` (cost centre, GL, budget line, HOD auto) |
| 3 | Requisition → tender conversion | **Shipped** (prefill + publish persists Open tender) | Procurement → Convert · Studio `?fromReq=` |
| 4 | RFQ form-builder + uploads | **Shipped** (builder + Open tender on publish) | `/rfq` |
| 5 | Tender notify / open-apply | **Shipped** (notifications + Supplier invitations) | Studio / RFQ publish → `/supplier` |
| 6 | PO → supplier DB after award | **Shipped** (LPO feed section) | `/suppliers-db` |
| 7 | Supplier Database + analytics + OCR | **Shipped** (OCR labelled ready) | `/suppliers-db` |
| 8 | Tender-tied supplier compare | **Shipped** | `/suppliers-db` |
| 9 | Per-RFQ per-supplier documents | **Shipped** (demo packs) | `/suppliers-db` |
| 10 | LPO process in-system | **Shipped** (award → PO + `/lpo`) | Bid board → Prepare award → LPO |
| 11–13 | Compliance home, exceptions, UAT green light | **Shipped** (green light unlocks award) | `/compliance` |
| 14 | Invoice vs LPO match | **Shipped** | Finance → Exception desk |
| 15 | SharePoint invoice automation | **Investigated / CTA** | Finance “Automate via SharePoint” → Integrations |
| 16 | Budget Owner dashboard | **Shipped** | `/budget` |
| 17 | Risk/Compliance officer dashboard | **Shipped** | `/compliance` (+ Governance) |
| 18 | HOD submission interface | **Shipped** | `/hod` |
| 19 | Contract Manager portal | **Shipped** (re-tender → Studio) | `/contracts-mgr` → `?fromContract=` |
| 20 | Single unified chatbot | **Already done** | `/copilot` |
| — | Notifications + activity timeline | **Shipped (step 2)** | `/notifications` + topbar bell |

## Demo roles to show leaders

| Role (demo picker) | Opens |
|--------------------|--------|
| Head of Department | `/hod` |
| Budget Owner | `/budget` |
| Procurement | Procurement + RFQ + Supplier DB |
| Auditor | `/compliance` |
| Contract Manager | `/contracts-mgr` |
| Finance | Invoice ↔ LPO |

## Still open / next iteration (partially advanced 26 Jul)

- [x] Demo / no Microsoft auth (VITE_USE_DEMO_DATA + VITE_DISABLE_MS_AUTH)
- [x] LPO desk + bank LPO print template (`/lpo`)
- [x] RFQ schema + responses persist in browser (`rfqStore`)
- [x] End-to-end role handoffs (HOD → Studio template/AI → bid → green light → award → LPO)
- [x] Studio bank template upload (AI follows structure)
- [x] Entra group script includes HOD / Budget Owner / Contract Manager (re-run script to provision)
- [ ] Real Azure Document Intelligence keys
- [ ] Live SharePoint Graph watcher
- [x] Dataverse tables + React persistence adapter for RFQ schema / responses (provision in target tenant)
- [ ] Provision Entra groups in tenant (`.\entra\create-FpipSecurityGroups.ps1`)
- [ ] Re-enable MSAL when authenticator available (`VITE_USE_DEMO_DATA=false`, `VITE_DISABLE_MS_AUTH=false`)
