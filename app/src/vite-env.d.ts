/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AAD_CLIENT_ID: string;
  readonly VITE_AAD_TENANT_ID: string;
  readonly VITE_AAD_AUTHORITY: string;
  readonly VITE_DATAVERSE_URL: string;
  readonly VITE_DATAVERSE_SCOPE: string;
  readonly VITE_SUPPLIER_AAD_CLIENT_ID: string;
  readonly VITE_SUPPLIER_AAD_AUTHORITY: string;
  readonly VITE_USE_DEMO_DATA: string;
  /** When true, skip MSAL entirely (same as demo for auth). */
  readonly VITE_DISABLE_MS_AUTH: string;
  readonly VITE_AGENT_SERVICE_URL: string;
  /** JSON map of Entra group Object ID → FPIP role id */
  readonly VITE_ENTRA_GROUP_MAP: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
