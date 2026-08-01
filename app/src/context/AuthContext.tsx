// Auth context: a single FpipAuth interface implemented by either the MSAL
// provider (real Entra ID) or the demo provider (no auth). Components use
// useFpipAuth() regardless of which is active.

import { createContext, useContext } from 'react';
import type { AccountInfo, InteractionStatus, IPublicClientApplication } from '@azure/msal-browser';

export interface FpipAuth {
  instance: IPublicClientApplication;
  accounts: AccountInfo[];
  account: AccountInfo | undefined;
  inProgress: InteractionStatus;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getDataverseToken: () => Promise<string>;
}

const AuthContext = createContext<FpipAuth | null>(null);

export { AuthContext };

export function useFpipAuth(): FpipAuth {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useFpipAuth must be used within an auth provider.');
  return ctx;
}
