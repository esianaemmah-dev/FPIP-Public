import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icons';
import { RolePipeline } from '@/components/RolePipeline';
import { useRole } from '@/context/RoleContext';
import {
  FEATURE_LABELS,
  getRole,
  type FeatureId,
  type RoleId,
} from '@/lib/rbac';
import { DEFAULT_GROUP_ROLE_MAP } from '@/lib/entraRoles';
import { classNames } from '@/lib/format';

const MATRIX_FEATURES: FeatureId[] = [
  'dashboard',
  'procurement',
  'tender_studio',
  'finance',
  'supplier',
  'governance',
  'copilot',
  'integrations',
  'admin',
  'approvals_act',
  'payments_release',
  'tender_publish',
  'policy_edit',
  'user_admin',
  'integration_admin',
  'workflows',
  'document_vault',
  'notifications',
  'hod_submit',
  'supplier_db',
  'compliance_risk',
  'budget_owner_dash',
  'contract_mgr',
  'rfq_builder',
  'lpo_desk',
];

export function Admin() {
  const { roles, can, featureOverrides, setRoleFeatures, resetOverrides, roleId, setRoleId } = useRole();
  const [selectedDept, setSelectedDept] = useState<RoleId>('procurement');
  const isAdmin = can('admin');

  const selected = getRole(selectedDept);
  const currentFeatures = useMemo(() => {
    return new Set(featureOverrides[selectedDept] ?? selected.features);
  }, [featureOverrides, selectedDept, selected.features]);

  function toggleFeature(feature: FeatureId) {
    if (!isAdmin || selectedDept === 'admin') return;
    const next = new Set(currentFeatures);
    if (next.has(feature)) next.delete(feature);
    else next.add(feature);
    // Admin always keeps admin capabilities on the admin role
    setRoleFeatures(selectedDept, Array.from(next) as FeatureId[]);
  }

  if (!isAdmin) {
    return (
      <div className="admin-denied">
        <Icon name="lock" size={28} />
        <h2>Administration restricted</h2>
        <p>
          Only Platform Admins can manage roles and feature access. Switch your role to{' '}
          <strong>Platform Admin</strong> in the top bar, or ask your tenant admin for access.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <section className="admin-hero" id="admin-rbac">
        <div>
          <div className="eyebrow">Role-based access control</div>
          <h1>Departments & access</h1>
          <p>
            Assign modules and actions to each department. Users only see what their role is
            granted. Platform Admin retains full control of RBAC and integrations.
          </p>
        </div>
        <div className="admin-hero-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={resetOverrides}>
            Reset to defaults
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setRoleId(roleId)}>
            Save matrix
          </button>
        </div>
      </section>

      <section className="admin-panel" style={{ marginBottom: 20 }}>
        <RolePipeline />
      </section>

      <div className="dept-grid" id="admin-summaries">
        {roles.map((r) => (
          <button
            key={r.id}
            type="button"
            className={classNames('dept-card', selectedDept === r.id && 'active')}
            onClick={() => setSelectedDept(r.id)}
          >
            <div className="dept-card-head">
              <Icon name={r.icon} size={18} />
              <span className="dept-badge">{r.department}</span>
            </div>
            <div className="dept-name">{r.name}</div>
            <p>{r.description}</p>
            <div className="dept-stats">
              {(featureOverrides[r.id] ?? r.features).length} features enabled
            </div>
          </button>
        ))}
      </div>

      <section className="admin-panel" id="admin-matrix">
        <div className="admin-panel-head">
          <div>
            <h2>Feature matrix — {selected.name}</h2>
            <p className="muted">{selected.department} · toggle what this department can open and do</p>
          </div>
          {selectedDept === 'admin' ? (
            <span className="pill">Full access (locked)</span>
          ) : (
            <span className="pill muted-pill">Editable by admin</span>
          )}
        </div>

        <div className="matrix-table-wrap">
          <table className="matrix-table">
            <thead>
              <tr>
                <th>Capability</th>
                <th>Access</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX_FEATURES.map((f) => {
                const on = currentFeatures.has(f);
                const locked = selectedDept === 'admin';
                return (
                  <tr key={f}>
                    <td>
                      <div className="matrix-feature">{FEATURE_LABELS[f]}</div>
                      <div className="matrix-id">{f}</div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={classNames('toggle', on && 'on', locked && 'locked')}
                        disabled={locked}
                        onClick={() => toggleFeature(f)}
                        aria-pressed={on}
                      >
                        <span className="toggle-knob" />
                        <span className="toggle-label">{on ? 'Allowed' : 'Denied'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="access-split">
          <div>
            <h3>This department can</h3>
            <ul>
              {selected.can.map((c) => (
                <li key={c}>
                  <Icon name="check" size={14} /> {c}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>This department cannot</h3>
            <ul className="cannot">
              {selected.cannot.map((c) => (
                <li key={c}>
                  <Icon name="close" size={14} /> {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="admin-panel" id="admin-entra">
        <h2>Microsoft Entra ID mapping</h2>
        <p className="muted">
          Production tenants assign FPIP roles via Entra security groups or app roles. Map group Object IDs
          in <code>VITE_ENTRA_GROUP_MAP</code> (JSON). Without Entra sign-in, use the role picker instead.
        </p>
        <table className="entra-map-table">
          <thead>
            <tr>
              <th>Entra group / app role</th>
              <th>FPIP department</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(DEFAULT_GROUP_ROLE_MAP).map(([group, roleId]) => (
              <tr key={group}>
                <td>
                  <code>{group}</code>
                </td>
                <td>{getRole(roleId).name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="admin-panel">
        <h2>Admin vs departments</h2>
        <div className="compare-grid">
          <div className="compare-card admin">
            <div className="eyebrow">Platform Admin</div>
            <ul>
              <li>Assign and revoke features for every department</li>
              <li>Open Administration and Integrations</li>
              <li>Configure connectors (Dataverse, Entra, Fabric, AI)</li>
              <li>Manage users / roles (user_admin)</li>
              <li>Edit approval policies and control matrix</li>
            </ul>
          </div>
          <div className="compare-card">
            <div className="eyebrow">Department users</div>
            <ul>
              <li>See only modules granted in the matrix</li>
              <li>Act only within allowed actions (approve / pay / publish)</li>
              <li>Use FPIP Assistant when <code>copilot</code> is granted</li>
              <li>Never manage other departments&apos; access</li>
              <li>Supplier role stays isolated to own records</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
