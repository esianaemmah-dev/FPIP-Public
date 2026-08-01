import type { ReactNode } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { DemoBanner } from '@/components/DemoBanner';
import { classNames } from '@/lib/format';
import { useRole } from '@/context/RoleContext';
import type { FeatureId } from '@/lib/rbac';

import { ExecutiveDashboard } from '@/pages/ExecutiveDashboard';
import { Procurement } from '@/pages/Procurement';
import { TenderStudio } from '@/pages/TenderStudio';
import { Finance } from '@/pages/Finance';
import { SupplierPortal } from '@/pages/SupplierPortal';
import { Governance } from '@/pages/Governance';
import { Copilot } from '@/pages/Copilot';
import { Admin } from '@/pages/Admin';
import { Integrations } from '@/pages/Integrations';
import { Workflows } from '@/pages/Workflows';
import { DocumentVault } from '@/pages/DocumentVault';
import { Notifications } from '@/pages/Notifications';
import { HodRequisition } from '@/pages/HodRequisition';
import { SupplierDatabase } from '@/pages/SupplierDatabase';
import { ComplianceRisk } from '@/pages/ComplianceRisk';
import { BudgetOwner } from '@/pages/BudgetOwner';
import { ContractManager } from '@/pages/ContractManager';
import { RfqBuilder } from '@/pages/RfqBuilder';
import { LpoDesk } from '@/pages/LpoDesk';

function AccessGate({ feature, children }: { feature: FeatureId; children: ReactNode }) {
  const { can } = useRole();
  if (!can(feature)) {
    if (can('supplier')) return <Navigate to="/supplier" replace />;
    if (can('finance')) return <Navigate to="/finance" replace />;
    if (can('procurement')) return <Navigate to="/procurement" replace />;
    if (can('hod_submit')) return <Navigate to="/hod" replace />;
    if (can('budget_owner_dash')) return <Navigate to="/budget" replace />;
    if (can('compliance_risk')) return <Navigate to="/compliance" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function CurrentPage() {
  const { pathname } = useLocation();
  const { can } = useRole();

  if (pathname.startsWith('/procurement/studio')) {
    return (
      <AccessGate feature="tender_studio">
        <TenderStudio />
      </AccessGate>
    );
  }

  switch (pathname) {
    case '/dashboard':
    case '/':
      if (!can('dashboard')) {
        if (can('supplier')) return <Navigate to="/supplier" replace />;
        if (can('finance')) return <Navigate to="/finance" replace />;
        if (can('procurement')) return <Navigate to="/procurement" replace />;
        return <Navigate to="/copilot" replace />;
      }
      return <ExecutiveDashboard />;
    case '/procurement':
      return (
        <AccessGate feature="procurement">
          <Procurement />
        </AccessGate>
      );
    case '/finance':
      return (
        <AccessGate feature="finance">
          <Finance />
        </AccessGate>
      );
    case '/supplier':
      return (
        <AccessGate feature="supplier">
          <SupplierPortal />
        </AccessGate>
      );
    case '/governance':
      return (
        <AccessGate feature="governance">
          <Governance />
        </AccessGate>
      );
    case '/workflows':
      return (
        <AccessGate feature="workflows">
          <Workflows />
        </AccessGate>
      );
    case '/vault':
      return (
        <AccessGate feature="document_vault">
          <DocumentVault />
        </AccessGate>
      );
    case '/notifications':
      return (
        <AccessGate feature="notifications">
          <Notifications />
        </AccessGate>
      );
    case '/hod':
      return (
        <AccessGate feature="hod_submit">
          <HodRequisition />
        </AccessGate>
      );
    case '/suppliers-db':
      return (
        <AccessGate feature="supplier_db">
          <SupplierDatabase />
        </AccessGate>
      );
    case '/compliance':
      return (
        <AccessGate feature="compliance_risk">
          <ComplianceRisk />
        </AccessGate>
      );
    case '/budget':
      return (
        <AccessGate feature="budget_owner_dash">
          <BudgetOwner />
        </AccessGate>
      );
    case '/contracts-mgr':
      return (
        <AccessGate feature="contract_mgr">
          <ContractManager />
        </AccessGate>
      );
    case '/rfq':
      return (
        <AccessGate feature="rfq_builder">
          <RfqBuilder />
        </AccessGate>
      );
    case '/lpo':
      return (
        <AccessGate feature="lpo_desk">
          <LpoDesk />
        </AccessGate>
      );
    case '/copilot':
      return (
        <AccessGate feature="copilot">
          <Copilot />
        </AccessGate>
      );
    case '/admin':
      return (
        <AccessGate feature="admin">
          <Admin />
        </AccessGate>
      );
    case '/integrations':
      return (
        <AccessGate feature="integrations">
          <Integrations />
        </AccessGate>
      );
    default:
      return <Navigate to="/dashboard" replace />;
  }
}

export function AppLayout() {
  const { pathname } = useLocation();
  const isCopilot = pathname === '/copilot';
  const isStudio = pathname.startsWith('/procurement/studio');
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <DemoBanner />
        <Topbar />
        <div className={classNames('content', (isCopilot || isStudio) && 'content-fixed')}>
          <div className={classNames('page', 'active', isCopilot && 'is-copilot', isStudio && 'is-studio')}>
            <CurrentPage />
          </div>
        </div>
      </div>
    </div>
  );
}
