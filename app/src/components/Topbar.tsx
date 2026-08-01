import { useLocation, useNavigate } from 'react-router-dom';
import { sideNav, navKeyFromPath, modules } from '@/lib/nav';
import { useFpipAuth } from '@/auth/useFpipAuth';
import { useRole } from '@/context/RoleContext';
import { useTenant } from '@/context/TenantContext';
import { useLocale } from '@/context/LocaleContext';
import type { RoleId } from '@/lib/rbac';
import type { SupportedCurrency } from '@/lib/tenant';
import type { LocaleId } from '@/lib/i18n';
import { Icon } from './Icons';
import { useNotifications } from '@/context/NotificationContext';

export function Topbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const cfg = sideNav[navKeyFromPath(pathname)];
  const { account, logout } = useFpipAuth();
  const { roleId, setRoleId, roles, role, can, isDemoRolePicker, isViewAs, entraRoleId, clearViewAs } = useRole();
  const { entity, entityId, setEntityId, currency, setCurrency, entities, currencies } = useTenant();
  const { locale, setLocale, t, locales } = useLocale();
  const { unreadCount } = useNotifications();
  const name = account?.name || account?.username || 'FPIP User';
  const initials = name.charAt(0).toUpperCase();

  function onRoleChange(next: RoleId) {
    setRoleId(next);
    const home: Record<RoleId, string> = {
      admin: '/admin',
      executive: '/dashboard',
      procurement: '/procurement',
      finance: '/finance',
      auditor: '/compliance',
      supplier: '/supplier',
      hod: '/hod',
      budget_owner: '/budget',
      contract_manager: '/contracts-mgr',
    };
    navigate(home[next] ?? '/dashboard');
  }

  const moduleLabel = (key: string) => {
    const m = modules.find((x) => x.key === key);
    if (!m) return cfg.title;
    const map: Record<string, string> = {
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
    return map[m.key] ?? m.label;
  };

  const navKey = navKeyFromPath(pathname);
  const title = [
    'workflows',
    'vault',
    'integrations',
    'admin',
    'copilot',
    'dashboard',
    'procurement',
    'finance',
    'supplier',
    'governance',
    'studio',
    'notifications',
    'hod',
    'suppliers-db',
    'compliance',
    'budget',
    'contracts-mgr',
    'rfq',
    'lpo',
  ].includes(navKey)
    ? moduleLabel(navKey === 'studio' ? 'procurement' : navKey)
    : cfg.title;

  return (
    <div className="topbar">
      <div>
        <div className="topbar-title">{title}</div>
        <div className="topbar-sub">{cfg.sub}</div>
      </div>
      <div className="role-switch">
        <label className="role-picker" title={t('topbar.entity')}>
          <span className="role-picker-label">{t('topbar.entity')}</span>
          <select value={entityId} onChange={(e) => setEntityId(e.target.value)} aria-label={t('topbar.entity')}>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className="role-picker" title={t('topbar.currency')}>
          <span className="role-picker-label">{t('topbar.currency')}</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as SupportedCurrency)}
            aria-label={t('topbar.currency')}
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="role-picker" title={t('topbar.language')}>
          <span className="role-picker-label">{t('topbar.language')}</span>
          <select value={locale} onChange={(e) => setLocale(e.target.value as LocaleId)} aria-label={t('topbar.language')}>
            {locales.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        {isDemoRolePicker ? (
          <label className="role-picker" title="Switch role">
            <span className="role-picker-label">{t('topbar.role')}</span>
            <select value={roleId} onChange={(e) => onRoleChange(e.target.value as RoleId)} aria-label="Active role">
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="entra-role-badge" title={t('topbar.role.entra')}>
            {role.name}
            {isViewAs ? (
              <button type="button" className="view-as-clear" onClick={clearViewAs}>
                exit view-as
              </button>
            ) : null}
          </span>
        )}
        {!isDemoRolePicker && can('user_admin') ? (
          <label className="role-picker" title="Admin view-as">
            <span className="role-picker-label">View as</span>
            <select
              value={isViewAs ? roleId : entraRoleId ?? roleId}
              onChange={(e) => onRoleChange(e.target.value as RoleId)}
              aria-label="View as role"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {can('admin') ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/admin')}>
            Admin
          </button>
        ) : null}
        <span className="role-select" title={name}>
          {name}
        </span>
        <button
          type="button"
          className="bell notif-bell-wrap"
          aria-label="Notifications"
          onClick={() => navigate('/notifications')}
        >
          <Icon name="bell" size={18} />
          {unreadCount > 0 ? <span className="bell-count">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
        </button>
        <div className="avatar" title={`${name} · ${role.name} · ${entity.name}`}>
          {initials}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => logout()} title={t('topbar.signOut')}>
          {t('topbar.signOut')}
        </button>
      </div>
    </div>
  );
}
