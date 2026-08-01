/** Deterministic demo replies when Azure OpenAI is not configured. */

import { routeAssistantIntent } from '@/lib/rbac';

export async function streamDemoAssistant(
  message: string,
  onToken: (token: string) => void,
): Promise<string> {
  const intent = routeAssistantIntent(message);
  const text = buildDemoReply(message, intent);
  const threadId = `demo-${Date.now()}`;

  for (const chunk of chunkWords(text)) {
    onToken(chunk);
    await delay(12);
  }
  return threadId;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function chunkWords(text: string): string[] {
  return text.split(/(\s+)/).filter(Boolean);
}

function isOffTopic(message: string): boolean {
  const m = message.toLowerCase();
  const fpip =
    /\b(invoice|tender|contract|approval|budget|spend|supplier|procurement|finance|compliance|risk|requisition|payment|policy|fpip|novaris|audit|bid|rfp|rfq|purchase\s*order|\bpo\b|exception|renewal)\b/i.test(
      m,
    );
  if (fpip) return false;
  return /\b(world\s*cup|fifa|football|soccer|nba|nfl|cricket|olympics|movie|weather|joke|recipe|who\s+won|live\s+score)\b/i.test(
    m,
  );
}

function buildDemoReply(message: string, intent: string): string {
  const q = message.trim();
  if (isOffTopic(q)) {
    return (
      `**FPIP Assistant**\n\n` +
      `I only help with this platform's finance, procurement, contracts, invoices, approvals, ` +
      `budgets, compliance, and supplier records.\n\n` +
      `I can't answer general topics like sports or news. ` +
      `Ask about pending approvals, expiring contracts, or spend by category — ` +
      `or tell me if you meant an FPIP tender/contract related to an event.`
    );
  }

  const header =
    `**FPIP Assistant**\n\n`;

  const bodies: Record<string, string> = {
    finance:
      `### Finance snapshot\n` +
      `- **3 invoices** sitting in exception (duplicate / PO mismatch / missing receipt).\n` +
      `- Largest exposure: **INV-4412 · $184,200** — 3-way match failed on quantity.\n` +
      `- Next payment run draft: **$2.1M** across 47 invoices (human release required).\n` +
      `- Budget utilization (IT infra): **91%** of Q3 — flag before additional POs.\n\n` +
      `I can outline clearance steps, but **I cannot release payment**.`,
    procurement:
      `### Procurement snapshot\n` +
      `- **RFP-118 Cloud SI** — 3 bids received; evaluation window closes Friday.\n` +
      `- Open requisitions awaiting approval: **12** (2 above policy threshold).\n` +
      `- Suggested next action: open Bid Board for RFP-118 and run a side-by-side score.\n\n` +
      `I can recommend, but **I cannot award** the tender.`,
    contract:
      `### Contracts\n` +
      `- **4 contracts** renew within 60 days (largest: Network Services · $920k).\n` +
      `- Clause risk: 2 MSAs missing updated data-processing addenda.\n` +
      `- Recommend routing renewals to Procurement owners this week.\n\n` +
      `I cannot modify contract records.`,
    compliance:
      `### Compliance\n` +
      `- **Pending approvals:** 8 (2 past SLA).\n` +
      `- Supplier docs expired: tax cert for **Kestrel Components**, insurance for **Northline**.` +
      `\n- SoD: no critical conflicts in the last 7 days.\n\n` +
      `Ask for a policy walkthrough or an approval-queue summary anytime.`,
    risk:
      `### Risk\n` +
      `- Supplier concentration: top 3 vendors = **41%** of IT spend.\n` +
      `- Elevated risk score on **Northline Logistics** (delivery SLA breaches).\n` +
      `- Recommend dual-source review for category “Managed Network”.`,
    spend:
      `### Spend\n` +
      `- Category leaders this quarter: Cloud ($1.2M), Professional Services ($860k), Facilities ($410k).\n` +
      `- Potential leakage vs contracted rates: ~**$74k**.\n` +
      `- I can break this down by cost center on request.`,
    supplier:
      `### Supplier view\n` +
      `- Open invitations on your account: **2**.\n` +
      `- One compliance document needs renewal before bid submission.\n` +
      `- I only see **your** supplier records in this role.`,
    knowledge:
      `### Knowledge\n` +
      `From FPIP SOPs:\n` +
      `- Approvals above $50k require dual finance + procurement sign-off.\n` +
      `- Agents are read-only: recommend only, never approve/pay/award.\n` +
      `- Tender Studio drafts must be human-published.`,
    executive:
      `### Executive brief\n` +
      `- Pipeline: **$6.4M** active tenders · **$2.1M** payment run staged.\n` +
      `- Attention: 8 overdue approvals · 4 contract renewals < 60 days.\n` +
      `- Risk: concentration and one elevated supplier score.\n\n` +
      `Say which area to deep-dive — procurement, finance, compliance, or risk.`,
  };

  const body = bodies[intent] ?? bodies.executive;
  return `${header}${body}\n\n---\n_Your question:_ “${q.slice(0, 240)}${q.length > 240 ? '…' : ''}”`;
}
