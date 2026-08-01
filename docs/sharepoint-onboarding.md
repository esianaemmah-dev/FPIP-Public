# SharePoint document management onboarding guide for FPIP customers

This document is for the **bank's SharePoint / Power Platform admin**.

## What FPIP configures in Dataverse

During FPIP_Core provisioning, the solution is prepared to enable native
SharePoint Document Management on:

- `fpip_compliancedocument`
- `fpip_contract`
- `fpip_supplier`

## What the bank provides

1. A SharePoint site (e.g. `https://<tenant>.sharepoint.com/sites/fpip-docs`).
2. A document library with folders per supplier/contract/compliance document type.
3. Grant the FPIP application users and internal security roles **Contribute**
   access to the library.

## Steps to enable document management

1. In the Power Platform admin center, select the FPIP environment.
2. Go to **Settings > Document management > Enable SharePoint document
   management** for the three tables above.
3. Specify the SharePoint site URL created above.
4. Test by uploading a compliance document from the Supplier Portal.

## Azure AI Search connector

The Azure AI Search SharePoint connector (configured in Phase 2) should be set
for **incremental refresh** so new documents are indexed automatically. Verify
by uploading a document and confirming it appears in search results within the
configured crawl interval.

## Security

- Supplier Portal users must only see their own supplier folder. Enforce this
  with SharePoint item-level permissions or folder-level security.
- Internal FPIP roles (Procurement, Finance, Compliance) should have read
  access to all relevant document folders.
- Do not store documents in Dataverse file columns; always use SharePoint
  document management.
