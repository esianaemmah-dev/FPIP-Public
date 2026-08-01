import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icons';
import { useNav } from '@/context/NavContext';
import { useRole } from '@/context/RoleContext';
import { useTenant } from '@/context/TenantContext';
import { useLocale } from '@/context/LocaleContext';
import { modules, sideNav, navKeyFromPath, type ModuleItem, type SideLink } from '@/lib/nav';
import { classNames } from '@/lib/format';
import type { FeatureId } from '@/lib/rbac';

/** Extra rail items only when the user does not already have the parent module. */
const EXTRA_MODULES: (ModuleItem & { hideIf?: FeatureId })[] = [
  { key: 'hod', path: '/hod', icon: 'user', label: 'Submit req', feature: 'hod_submit', hideIf: 'procurement' },
  { key: 'budget', path: '/budget', icon: 'bar', label: 'Budget', feature: 'budget_owner_dash', hideIf: 'finance' },
  {
    key: 'contracts-mgr',
    path: '/contracts-mgr',
    icon: 'contract',
    label: 'Contracts',
    feature: 'contract_mgr',
    hideIf: 'procurement',
  },
  { key: 'governance', path: '/governance', icon: 'shield', label: 'Governance', feature: 'governance' },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const key = navKeyFromPath(pathname);
  const cfg = sideNav[key] ?? sideNav.dashboard;
  const { sidebarCollapsed, toggleSidebar, scrollToId, openTab, currentTab, selectAgent } = useNav();
  const { can, role } = useRole();
  const { entity } = useTenant();
  const { t } = useLocale();

  const moduleLabels: Record<string, string> = {
    dashboard: t('nav.dashboard'),
    procurement: t('nav.procurement'),
    finance: t('nav.finance'),
    supplier: t('nav.supplier'),
    governance: t('nav.governance'),
    workflows: t('nav.workflows'),
    vault: t('nav.vault'),
    copilot: t('nav.copilot'),
    integrations: t('nav.integrations'),
    admin: t('nav.admin'),
  };

  const visibleModules = [
    ...modules.filter((m) => can(m.feature)),
    ...EXTRA_MODULES.filter((m) => can(m.feature) && (!m.hideIf || !can(m.hideIf))),
  ];
  const visibleLinks = (cfg.links ?? []).filter((l) => !l.feature || can(l.feature));

  const moduleActive = (path: string) => {
    if (path === '/dashboard') return pathname === '/' || pathname.startsWith('/dashboard');
    if (path === '/procurement') {
      return (
        pathname.startsWith('/procurement') ||
        pathname.startsWith('/rfq') ||
        pathname.startsWith('/lpo') ||
        pathname.startsWith('/suppliers-db') ||
        pathname.startsWith('/hod') ||
        pathname.startsWith('/contracts-mgr')
      );
    }
    if (path === '/finance') return pathname.startsWith('/finance') || pathname.startsWith('/budget');
    if (path === '/compliance') return pathname.startsWith('/compliance') || pathname.startsWith('/governance');
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  function handleClick(link: SideLink) {
    if (link.action.type === 'route') navigate(link.action.path);
    else if (link.action.type === 'scroll') scrollToId(link.action.target);
    else if (link.action.type === 'tab') {
      if (!pathname.startsWith('/procurement') && link.action.group === 'procurement') navigate('/procurement');
      if (!pathname.startsWith('/finance') && link.action.group === 'finance') navigate('/finance');
      openTab(link.action.group, link.action.tab);
    } else selectAgent(link.action.agent);
  }

  function isSectionActive(link: SideLink): boolean {
    if (link.action.type === 'route') return pathname.startsWith(link.action.path);
    if (link.action.type === 'tab') {
      return currentTab(link.action.group) === link.action.tab && !pathname.includes('/studio');
    }
    return false;
  }

  return (
    <aside className={classNames('sidebar', sidebarCollapsed && 'collapsed')}>
      <div
        className="sidebar-brand"
        onClick={() => navigate(can('supplier') && !can('dashboard') ? '/supplier' : can('finance') && !can('dashboard') ? '/finance' : '/dashboard')}
        role="button"
        tabIndex={0}
      >
        <div className="sidebar-brand-mark">F</div>
        {!sidebarCollapsed ? (
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-name">FPIP</div>
            <div className="sidebar-brand-tag">Finance &amp; Procurement</div>
          </div>
        ) : null}
        <button
          type="button"
          className="sidebar-toggle"
          onClick={(e) => {
            e.stopPropagation();
            toggleSidebar();
          }}
          title={sidebarCollapsed ? 'Expand' : 'Collapse'}
        >
          <Icon name="chevron" size={13} />
        </button>
      </div>

      {!sidebarCollapsed ? (
        <div className="org-card" title={`${entity.name} — ${role.name}`}>
          <div className="org-name">{entity.name}</div>
          <div className="org-meta">{role.name}</div>
        </div>
      ) : null}

      <nav className="sidebar-nav" aria-label="Primary">
        <div className="sidebar-title">Menu</div>
        {visibleModules.map((m) => (
          <button
            key={m.key}
            type="button"
            className={classNames('side-link', moduleActive(m.path) && 'active')}
            title={m.label}
            onClick={() => navigate(m.path)}
          >
            <Icon name={m.icon} size={16} />
            <span className="side-link-label">{moduleLabels[m.key] ?? m.label}</span>
          </button>
        ))}
      </nav>

      {visibleLinks.length > 0 ? (
        <nav className="sidebar-nav sidebar-nav-secondary" aria-label="This page">
          <div className="sidebar-title">On this page</div>
          {visibleLinks.map((l) => (
            <button
              key={l.label}
              type="button"
              className={classNames('side-link', 'side-link-sub', isSectionActive(l) && 'active')}
              title={l.label}
              onClick={() => handleClick(l)}
            >
              <Icon name={l.icon} size={15} />
              <span className="side-link-label">{l.label}</span>
              {l.badge && !sidebarCollapsed ? <span className="side-badge">{l.badge}</span> : null}
            </button>
          ))}
        </nav>
      ) : null}
    </aside>
  );
}
