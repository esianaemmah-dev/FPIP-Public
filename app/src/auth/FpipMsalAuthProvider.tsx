// Real Entra ID (MSAL) auth provider. Must be rendered inside <MsalProvider>.
// Shows an explicit Sign-in screen (no silent auto-redirect) so a failed
// redirect never looks like a blank page.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { AuthContext, type FpipAuth } from '@/context/AuthContext';
import { loginRequest, dataverseTokenRequest } from './msalConfig';
import { setDataverseTokenProvider } from '@/api/dataverseClient';
import { LoadingScreen } from '@/components/Screens';
import { Seal } from '@/components/Seal';

export function FpipMsalAuthProvider({ children }: { children: ReactNode }) {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const account = accounts[0] ?? instance.getActiveAccount() ?? undefined;
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const login = useCallback(async () => {
    setLoginError(null);
    setSigningIn(true);
    try {
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      setSigningIn(false);
      setLoginError(err instanceof Error ? err.message : 'Sign-in failed');
    }
  }, [instance]);

  const logout = useCallback(async () => {
    await instance.logoutRedirect();
  }, [instance]);

  const getDataverseToken = useCallback(async (): Promise<string> => {
    const active = account ?? instance.getActiveAccount();
    if (!active) throw new Error('Not authenticated: no Entra ID account available.');
    try {
      const res = await instance.acquireTokenSilent({ ...dataverseTokenRequest, account: active });
      return res.accessToken;
    } catch {
      await instance.acquireTokenRedirect({ ...dataverseTokenRequest, account: active });
      return '';
    }
  }, [instance, account]);

  useEffect(() => {
    setDataverseTokenProvider(getDataverseToken);
  }, [getDataverseToken]);

  const value = useMemo<FpipAuth>(
    () => ({ instance, accounts, account, inProgress, isAuthenticated, login, logout, getDataverseToken }),
    [instance, accounts, account, inProgress, isAuthenticated, login, logout, getDataverseToken],
  );

  if (inProgress !== InteractionStatus.None || signingIn) {
    return <LoadingScreen label="Signing in to FPIP…" />;
  }

  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f3f4f7',
          fontFamily: 'system-ui, sans-serif',
          padding: 24,
        }}
      >
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e5ec',
            borderRadius: 12,
            padding: 32,
            maxWidth: 420,
            width: '100%',
            boxShadow: '0 8px 24px rgba(15,23,42,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <Seal size="lg" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 20 }}>FPIP</div>
              <div style={{ color: '#64748b', fontSize: 13 }}>Finance & Procurement Intelligence</div>
            </div>
          </div>
          <p style={{ color: '#475569', lineHeight: 1.5, marginTop: 0 }}>
            Sign in with your Microsoft work account to open the platform.
          </p>
          {loginError ? (
            <p style={{ color: '#b91c1c', fontSize: 13, background: '#fef2f2', padding: 10, borderRadius: 8 }}>
              {loginError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void login()}
            style={{
              width: '100%',
              marginTop: 8,
              padding: '12px 16px',
              border: 0,
              borderRadius: 8,
              background: '#0f766e',
              color: '#fff',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Sign in with Microsoft
          </button>
          <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 0, marginTop: 16 }}>
            Having trouble? Open this site in an InPrivate/Incognito window, or append{' '}
            <code>?demo=1</code> for seed-data review.
          </p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
