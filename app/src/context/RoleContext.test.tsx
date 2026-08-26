// Behavioral tests for the RBAC gate that Sidebar.tsx (and every module page)
// reads via useRole().can(feature) — this is what actually hides/shows
// modules and routes per role, not just the pure roleHasFeature() helper.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isDemoMode: true,
  account: undefined as { idTokenClaims?: Record<string, unknown> } | undefined,
}));

vi.mock('@/api/dataverseClient', () => ({
  get isDemoMode() {
    return mocks.isDemoMode;
  },
}));

vi.mock('@/auth/useFpipAuth', () => ({
  useFpipAuth: () => ({ account: mocks.account }),
}));

import { RoleProvider, useRole } from './RoleContext';

function Probe() {
  const { roleId, can, setRoleId, setRoleFeatures, isViewAs } = useRole();
  return (
    <div>
      <span data-testid="role">{roleId}</span>
      <span data-testid="view-as">{String(isViewAs)}</span>
      <span data-testid="can-finance">{String(can('finance'))}</span>
      <span data-testid="can-supplier">{String(can('supplier'))}</span>
      <span data-testid="can-vault">{String(can('document_vault'))}</span>
      <button onClick={() => setRoleId('supplier')}>go-supplier</button>
      <button onClick={() => setRoleId('finance')}>go-finance</button>
      <button onClick={() => setRoleFeatures('supplier', ['document_vault'])}>grant-vault-override</button>
    </div>
  );
}

function renderWithRole() {
  return render(
    <RoleProvider>
      <Probe />
    </RoleProvider>,
  );
}

describe('RoleContext (demo mode — local role switcher)', () => {
  beforeEach(() => {
    mocks.isDemoMode = true;
    mocks.account = undefined;
    localStorage.clear();
  });

  it('defaults to the admin role with full module access', () => {
    renderWithRole();
    expect(screen.getByTestId('role')).toHaveTextContent('admin');
    expect(screen.getByTestId('can-finance')).toHaveTextContent('true');
  });

  it('hides finance-only features once switched to the supplier role', async () => {
    const user = userEvent.setup();
    renderWithRole();

    await user.click(screen.getByText('go-supplier'));

    expect(screen.getByTestId('role')).toHaveTextContent('supplier');
    expect(screen.getByTestId('can-finance')).toHaveTextContent('false');
    expect(screen.getByTestId('can-supplier')).toHaveTextContent('true');
  });

  it('never grants the supplier role Document Vault, even via a feature override', async () => {
    const user = userEvent.setup();
    renderWithRole();

    await user.click(screen.getByText('go-supplier'));
    await user.click(screen.getByText('grant-vault-override'));

    // roleHasFeature would say yes; RoleContext.can() hard-blocks it regardless —
    // suppliers must never reach the org-wide document store.
    expect(screen.getByTestId('can-vault')).toHaveTextContent('false');
  });
});

describe('RoleContext (live Entra mode — view-as restricted to admins)', () => {
  beforeEach(() => {
    mocks.isDemoMode = false;
    localStorage.clear();
  });

  it('does not let a non-admin Entra role switch into another department', async () => {
    mocks.account = { idTokenClaims: { roles: ['FPIP-Procurement'] } };
    const user = userEvent.setup();
    renderWithRole();

    expect(screen.getByTestId('role')).toHaveTextContent('procurement');

    await user.click(screen.getByText('go-finance'));

    expect(screen.getByTestId('role')).toHaveTextContent('procurement');
    expect(screen.getByTestId('view-as')).toHaveTextContent('false');
  });

  it('lets a platform admin Entra role view-as another department', async () => {
    mocks.account = { idTokenClaims: { roles: ['FPIP-Platform-Admin'] } };
    const user = userEvent.setup();
    renderWithRole();

    expect(screen.getByTestId('role')).toHaveTextContent('admin');

    await user.click(screen.getByText('go-finance'));

    expect(screen.getByTestId('role')).toHaveTextContent('finance');
    expect(screen.getByTestId('view-as')).toHaveTextContent('true');
  });
});
