export type LocaleId = 'en' | 'fr';

export const LOCALES: { id: LocaleId; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
];

type Dict = Record<string, string>;

const en: Dict = {
  'nav.dashboard': 'Command Center',
  'nav.procurement': 'Procurement',
  'nav.finance': 'Finance',
  'nav.supplier': 'Supplier Portal',
  'nav.governance': 'Governance',
  'nav.copilot': 'AI Assistant',
  'nav.workflows': 'Workflows',
  'nav.vault': 'Document Vault',
  'nav.integrations': 'Integrations',
  'nav.admin': 'Administration',
  'topbar.entity': 'Legal entity',
  'topbar.currency': 'Currency',
  'topbar.language': 'Language',
  'topbar.role': 'Role',
  'topbar.role.entra': 'Assigned by Entra ID',
  'topbar.signOut': 'Sign out',
  'workflows.title': 'Approval workflows',
  'workflows.sub': 'Human sign-off for requisitions, awards, and payments',
  'vault.title': 'Document vault',
  'vault.sub': 'Contracts, compliance evidence, and retention controls',
};

const fr: Dict = {
  'nav.dashboard': 'Centre de commande',
  'nav.procurement': 'Achats',
  'nav.finance': 'Finance',
  'nav.supplier': 'Portail fournisseur',
  'nav.governance': 'Gouvernance',
  'nav.copilot': 'Assistant IA',
  'nav.workflows': 'Workflows',
  'nav.vault': 'Coffre documentaire',
  'nav.integrations': 'Intégrations',
  'nav.admin': 'Administration',
  'topbar.entity': 'Entité juridique',
  'topbar.currency': 'Devise',
  'topbar.language': 'Langue',
  'topbar.role': 'Rôle',
  'topbar.role.entra': 'Attribué par Entra ID',
  'topbar.signOut': 'Déconnexion',
  'workflows.title': 'Workflows d’approbation',
  'workflows.sub': 'Validation humaine pour demandes, attributions et paiements',
  'vault.title': 'Coffre documentaire',
  'vault.sub': 'Contrats, conformité et rétention',
};

const PACKS: Record<LocaleId, Dict> = { en, fr };

export function t(locale: LocaleId, key: string): string {
  return PACKS[locale][key] ?? PACKS.en[key] ?? key;
}
