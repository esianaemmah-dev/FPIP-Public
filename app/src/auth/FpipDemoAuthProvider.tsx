// Demo auth provider: no Entra ID. Used when VITE_USE_DEMO_DATA=true so the UI
// can be reviewed locally without a live Dataverse environment or app reg.

import { useEffect, useMemo, type ReactNode } from 'react';
import { InteractionStatus, type AccountInfo, type IPublicClientApplication } from '@azure/msal-browser';
import { AuthContext, type FpipAuth } from '@/context/AuthContext';
import { setDataverseTokenProvider } from '@/api/dataverseClient';

const demoAccount = {
  homeAccountId: 'demo',
  environment: 'login.microsoftonline.com',
  tenantId: 'demo',
  localAccountId: 'demo',
  username: 'reviewer@fpip.local',
  name: 'FPIP Reviewer',
} as AccountInfo;

export function FpipDemoAuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo<FpipAuth>(
    () => ({
      instance: {} as IPublicClientApplication,
      accounts: [demoAccount],
      account: demoAccount,
      inProgress: InteractionStatus.None,
      isAuthenticated: true,
      login: async () => {},
      logout: async () => {},
      getDataverseToken: async () => '',
    }),
    [],
  );

  useEffect(() => {
    setDataverseTokenProvider(async () => '');
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
