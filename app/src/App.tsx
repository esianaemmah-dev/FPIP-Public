import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication, EventType, type AuthenticationResult } from '@azure/msal-browser';
import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { msalConfig, authConfigured } from '@/auth/msalConfig';
import { FpipMsalAuthProvider } from '@/auth/FpipMsalAuthProvider';
import { FpipDemoAuthProvider } from '@/auth/FpipDemoAuthProvider';
import { NavProvider } from '@/context/NavContext';
import { ModalProvider } from '@/context/ModalContext';
import { ToastProvider } from '@/context/ToastContext';
import { RoleProvider } from '@/context/RoleContext';
import { TenantProvider } from '@/context/TenantContext';
import { LocaleProvider } from '@/context/LocaleContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { AppLayout } from './AppLayout';
import { LoadingScreen, SetupScreen } from '@/components/Screens';
import { isDemoMode } from '@/api/dataverseClient';

/** One MSAL instance for the lifetime of the page (never create inside render). */
const msalInstance = authConfigured && !isDemoMode ? new PublicClientApplication(msalConfig) : null;

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('FPIP render error', error, info);
  }

  render() {
    if (this.state.error) {
      const detail =
        this.state.error.stack || this.state.error.message || String(this.state.error) || 'Unknown error';
      return (
        <div style={{ padding: 32, fontFamily: 'system-ui, sans-serif', maxWidth: 640 }}>
          <h1 style={{ color: '#b91c1c', marginTop: 0 }}>FPIP hit a display error</h1>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#fef2f2', padding: 16, borderRadius: 8 }}>
            {detail}
          </pre>
          <button
            type="button"
            onClick={() => window.location.assign('/')}
            style={{ marginTop: 12, padding: '10px 16px', cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ShellProviders({ children }: { children: ReactNode }) {
  return (
    <TenantProvider>
      <LocaleProvider>
        <RoleProvider>
          <NavProvider>
            <ModalProvider>
              <ToastProvider>
              <NotificationProvider>{children}</NotificationProvider>
            </ToastProvider>
            </ModalProvider>
          </NavProvider>
        </RoleProvider>
      </LocaleProvider>
    </TenantProvider>
  );
}

function MsalBoot({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    if (!msalInstance) return;
    let cancelled = false;
    (async () => {
      try {
        await msalInstance.initialize();
        await msalInstance.handleRedirectPromise();
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0 && !msalInstance.getActiveAccount()) {
          msalInstance.setActiveAccount(accounts[0]);
        }
        msalInstance.addEventCallback((event) => {
          if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
            const result = event.payload as AuthenticationResult;
            if (result.account) msalInstance.setActiveAccount(result.account);
          }
        });
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) {
          setBootError(err instanceof Error ? err.message : 'MSAL failed to start');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (bootError) {
    return (
      <div style={{ padding: 32, fontFamily: 'system-ui, sans-serif', background: '#f3f4f7', minHeight: '100vh' }}>
        <h2 style={{ color: '#b91c1c' }}>Sign-in could not start</h2>
        <p>{bootError}</p>
        <button type="button" onClick={() => window.location.reload()} style={{ padding: '10px 16px' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!ready || !msalInstance) {
    return <LoadingScreen label="Starting FPIP…" />;
  }

  return (
    <MsalProvider instance={msalInstance}>
      <FpipMsalAuthProvider>
        <ShellProviders>{children}</ShellProviders>
      </FpipMsalAuthProvider>
    </MsalProvider>
  );
}

function Providers({ children }: { children: ReactNode }) {
  // Auth disabled for now — always use demo provider (no Microsoft authenticator).
  if (isDemoMode || import.meta.env.VITE_DISABLE_MS_AUTH === 'true') {
    return (
      <FpipDemoAuthProvider>
        <ShellProviders>{children}</ShellProviders>
      </FpipDemoAuthProvider>
    );
  }
  if (!authConfigured) {
    return <SetupScreen />;
  }
  return <MsalBoot>{children}</MsalBoot>;
}

export function App() {
  // BrowserRouter must wrap NavProvider (which calls useNavigate).
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Providers>
          <Routes>
            <Route path="*" element={<AppLayout />} />
          </Routes>
        </Providers>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
