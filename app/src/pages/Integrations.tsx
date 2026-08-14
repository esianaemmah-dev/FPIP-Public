import { useState } from 'react';
import { Icon } from '@/components/Icons';
import { useRole } from '@/context/RoleContext';
import { useModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { INTEGRATIONS, type IntegrationDef } from '@/lib/rbac';
import { classNames } from '@/lib/format';

const STATUS_CLASS: Record<string, string> = {
  Connected: 'ok',
  Configured: 'warn',
  Available: 'idle',
  Attention: 'bad',
};

const SECTIONS: { id: string; title: string; categories: string[] }[] = [
  { id: 'int-identity', title: 'Identity & security', categories: ['Identity'] },
  { id: 'int-data', title: 'Data & documents', categories: ['Data', 'Documents', 'Banking data'] },
  { id: 'int-ai', title: 'AI, workflow & commercial', categories: ['AI', 'Workflow', 'Commercial'] },
];

const CONFIG_FIELDS: Record<string, { label: string; placeholder: string }[]> = {
  dataverse: [{ label: 'Environment URL', placeholder: 'https://org.crm.dynamics.com' }],
  entra: [{ label: 'Tenant ID', placeholder: '00000000-0000-0000-0000-000000000000' }],
  fabric: [{ label: 'SQL endpoint', placeholder: 'sqlanalytics.fabric.microsoft.com' }],
  sharepoint: [{ label: 'Site URL', placeholder: 'https://tenant.sharepoint.com/sites/fpip' }],
  'ai-search': [{ label: 'Search endpoint', placeholder: 'https://....search.windows.net' }],
  openai: [{ label: 'OpenAI endpoint', placeholder: 'https://....openai.azure.com/' }],
  'power-automate': [{ label: 'Environment', placeholder: 'Default-...' }],
  metering: [{ label: 'Webhook URL', placeholder: 'https://....azurewebsites.net/api/meter' }],
};

export function Integrations() {
  const { can } = useRole();
  const canManage = can('integration_admin') || can('admin');
  const { openModal, closeModal } = useModal();
  const { showToast } = useToast();
  const [statuses, setStatuses] = useState<Record<string, IntegrationDef['status']>>({});

  function getStatus(item: IntegrationDef): IntegrationDef['status'] {
    return statuses[item.id] ?? item.status;
  }

  function openConfigure(item: IntegrationDef) {
    const fields = CONFIG_FIELDS[item.id] ?? [{ label: 'Endpoint', placeholder: 'https://...' }];
    openModal({
      eyebrow: 'Connector',
      title: item.name,
      body: (
        <div className="int-config-form">
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>{item.description}</p>
          {fields.map((f) => (
            <label key={f.label} className="studio-field">
              <span>{f.label}</span>
              <input placeholder={f.placeholder} defaultValue={f.placeholder.includes('org') ? import.meta.env.VITE_DATAVERSE_URL : ''} />
            </label>
          ))}
          <p className="int-config-note">Secrets are stored in Azure Key Vault — never in the browser.</p>
        </div>
      ),
      foot: (
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={closeModal}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              showToast(`Connection test sent for ${item.name}`);
              closeModal();
            }}
          >
            Test connection
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setStatuses((s) => ({ ...s, [item.id]: 'Connected' }));
              showToast(`${item.name} saved — connector marked Connected`);
              closeModal();
            }}
          >
            Save
          </button>
        </>
      ),
    });
  }

  return (
    <div className="integrations-page">
      <section className="admin-hero" id="integrations-grid">
        <div>
          <div className="eyebrow">Enterprise connectors</div>
          <h1>Integrations</h1>
          <p>
            Standard platform connectors for identity, operational data, documents, AI grounding,
            and workflow.{' '}
            {canManage
              ? 'Configure endpoints here; secrets live in Key Vault.'
              : 'View-only for your role — ask Platform Admin to change connectors.'}
          </p>
        </div>
      </section>

      <div className="int-status-row">
        {(['Connected', 'Configured', 'Available', 'Attention'] as const).map((s) => (
          <div key={s} className="int-status-chip">
            <span className={classNames('dot', STATUS_CLASS[s])} />
            {s} · {INTEGRATIONS.filter((i) => getStatus(i) === s).length}
          </div>
        ))}
      </div>

      {SECTIONS.map((section) => (
        <Section
          key={section.id}
          id={section.id}
          title={section.title}
          items={INTEGRATIONS.filter((i) => section.categories.includes(i.category))}
          canManage={canManage}
          getStatus={getStatus}
          onConfigure={openConfigure}
        />
      ))}
    </div>
  );
}

function Section({
  id,
  title,
  items,
  canManage,
  getStatus,
  onConfigure,
}: {
  id: string;
  title: string;
  items: IntegrationDef[];
  canManage: boolean;
  getStatus: (i: IntegrationDef) => IntegrationDef['status'];
  onConfigure: (i: IntegrationDef) => void;
}) {
  if (!items.length) return null;
  return (
    <section className="admin-panel" id={id}>
      <h2>{title}</h2>
      <div className="int-grid">
        {items.map((item) => {
          const status = getStatus(item);
          return (
            <article key={item.id} className="int-card">
              <div className="int-card-top">
                <div className="int-icon">
                  <Icon
                    name={
                      item.category === 'AI'
                        ? 'sparkles'
                        : item.category === 'Identity'
                          ? 'lock'
                          : item.category === 'Workflow'
                            ? 'wand'
                            : 'doc'
                    }
                    size={18}
                  />
                </div>
                <span className={classNames('status-pill', STATUS_CLASS[status])}>{status}</span>
              </div>
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <div className="int-meta">
                <span>{item.category}</span>
                <span>Owner: {item.owner}</span>
              </div>
              {canManage ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onConfigure(item)}>
                  Configure
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
