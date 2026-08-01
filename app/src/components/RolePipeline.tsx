/** One-screen map of how FPIP roles hand work to each other. */

const STEPS = [
  {
    role: 'HOD',
    does: 'Submits bank requisition',
    next: 'Budget Owner sees envelope; Procurement converts',
  },
  {
    role: 'Budget Owner',
    does: 'Tracks spend vs department budget',
    next: 'Flags overruns before sourcing',
  },
  {
    role: 'Procurement',
    does: 'Studio / RFQ → publish Open tender (optional bank template + AI draft)',
    next: 'Suppliers invited; Compliance watches gate',
  },
  {
    role: 'Supplier',
    does: 'Bids + compliance docs on invitations',
    next: 'Bid board scores appear for Procurement',
  },
  {
    role: 'Auditor / Compliance',
    does: 'UAT + green light before award',
    next: 'Unlocks Prepare award → LPO',
  },
  {
    role: 'Procurement',
    does: 'Awards winning bid → creates LPO',
    next: 'Finance matches invoice to LPO',
  },
  {
    role: 'Finance',
    does: 'Exception desk, match, release payment',
    next: 'Audit trail in Governance / Vault',
  },
  {
    role: 'Contract Manager',
    does: 'Renewals hand off to Studio (?fromContract=)',
    next: 'Re-tender loop starts again',
  },
];

export function RolePipeline() {
  return (
    <div className="role-pipeline">
      <header className="studio-section-head" style={{ marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16 }}>How roles connect</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-soft)' }}>
            Switch the demo role picker to walk each step. AI drafts and analyses; humans publish, green-light, award,
            and pay.
          </p>
        </div>
      </header>
      <ol className="role-pipeline-list">
        {STEPS.map((s, i) => (
          <li key={`${s.role}-${i}`} className="role-pipeline-item">
            <span className="role-pipeline-n">{i + 1}</span>
            <div>
              <strong>{s.role}</strong>
              <div className="role-pipeline-does">{s.does}</div>
              <div className="role-pipeline-next">→ {s.next}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
