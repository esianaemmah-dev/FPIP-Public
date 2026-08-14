// MSAL configuration for the FPIP-Web-SPA Entra ID app registration (Phase 1
// Task 2). Values come from Vite env vars (see .env.example). The same module
// is reused for the Supplier Portal build by pointing the env at the
// FPIP-Supplier-External app registration.

import type { Configuration } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_AAD_CLIENT_ID ?? '';
const tenantId = import.meta.env.VITE_AAD_TENANT_ID ?? 'common';
const authority =
  import.meta.env.VITE_AAD_AUTHORITY ||
  `https://login.microsoftonline.com/${tenantId}`;

function resolveDataverseScope(): string {
  const explicit = import.meta.env.VITE_DATAVERSE_SCOPE;
  if (explicit) return explicit;
  const envUrl = import.meta.env.VITE_DATAVERSE_URL;
  // SPA delegated auth uses user_impersonation (not /.default — that is app-only).
  return envUrl ? `${envUrl.replace(/\/$/, '')}/user_impersonation` : '';
}

export const dataverseScope = resolveDataverseScope();
export const agentApiScope = import.meta.env.VITE_AGENT_API_SCOPE ?? '';

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority,
    redirectUri: typeof window !== 'undefined' ? `${window.location.origin}/` : 'http://localhost:5173/',
    postLogoutRedirectUri: typeof window !== 'undefined' ? `${window.location.origin}/` : 'http://localhost:5173/',
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

// Request the Dataverse scope up front so consent happens at login.
export const loginRequest = { scopes: [dataverseScope, agentApiScope].filter(Boolean) };
export const dataverseTokenRequest = { scopes: [dataverseScope] };
export const agentTokenRequest = { scopes: agentApiScope ? [agentApiScope] : [] };

/** True when the required Entra ID configuration is present. The app shows a
 *  setup screen instead of attempting MSAL init when this is false. */
export const authConfigured = Boolean(clientId) && Boolean(dataverseScope);
