// Full-screen loading + setup screens.

import { Seal } from './Seal';

export function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: '#f3f4f7',
        color: '#475569',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <Seal size="lg" />
      <div style={{ fontWeight: 600 }}>{label}</div>
    </div>
  );
}

export function SetupScreen() {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface)',
        padding: 24,
      }}
    >
      <div className="card" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <Seal size="lg" />
          <div>
            <h2>FPIP — setup required</h2>
            <div style={{ color: 'var(--ink-faint)', fontSize: 12.5 }}>
              Phase 1 React scaffold
            </div>
          </div>
        </div>
        <p style={{ color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>
          Entra ID configuration is missing. Copy <code>app/.env.example</code> to{' '}
          <code>app/.env.local</code> and fill in <code>VITE_AAD_CLIENT_ID</code>,{' '}
          <code>VITE_AAD_TENANT_ID</code> / <code>VITE_AAD_AUTHORITY</code>, and{' '}
          <code>VITE_DATAVERSE_URL</code> (plus <code>VITE_DATAVERSE_SCOPE</code> if not
          using the default). See <code>/entra/README.md</code> for the app-registration
          steps.
        </p>
        <p style={{ color: 'var(--ink-faint)', fontSize: 12.5, marginTop: 14 }}>
          For local visual review without a live environment, set{' '}
          <code>VITE_USE_DEMO_DATA=true</code> to bypass auth and show seed data.
        </p>
      </div>
    </div>
  );
}
