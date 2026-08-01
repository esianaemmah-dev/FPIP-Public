// Icon path data + <Icon> component. Ported from FPIP_UI_Demo.html's `icons` map
// and the inline rail SVGs. All icons are stroke-based, drawn in a 24x24 viewBox.

import type { CSSProperties } from 'react';

const paths: Record<string, string> = {
  grid: '<path d="M3 12h4v8H3zM10 6h4v14h-4zM17 3h4v17h-4z"/>',
  bar: '<path d="M4 20V10M12 20V4M20 20v-7"/>',
  alert: '<path d="M12 2 2 20h20L12 2z"/><path d="M12 9v5M12 17h.01"/>',
  doc: '<path d="M7 2h7l5 5v15H7z"/><path d="M14 2v5h5"/>',
  megaphone:
    '<path d="M3 11v2a2 2 0 0 0 2 2h1l3 5V4L6 9H5a2 2 0 0 0-2 2z"/><path d="M12 8.5a4 4 0 0 1 0 7"/>',
  cart: '<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.8h7.2a2 2 0 0 0 2-1.6L21 8H6"/>',
  scale:
    '<path d="M12 3v18M5 8l-3 6a4 4 0 0 0 8 0zM19 8l-3 6a4 4 0 0 0 8 0zM5 8h14M8 3h8"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  building:
    '<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6M9 12h.01M15 12h.01M9 16h.01M15 16h.01"/>',
  shield:
    '<path d="M12 2 3 6v6c0 5 3.8 8.5 9 10 5.2-1.5 9-5 9-10V6l-9-4z"/><path d="m9 12 2 2 4-4"/>',
  robot:
    '<rect x="4" y="4" width="16" height="14" rx="3"/><path d="M9 21h6M9 9h.01M15 9h.01M8 13c1 1.2 2.3 1.8 4 1.8s3-.6 4-1.8"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-8.9 8.4 9 9 0 0 1-3.4-.7L3 21l1.8-5a8.3 8.3 0 0 1-.8-3.6A8.4 8.4 0 0 1 12.6 3a8.4 8.4 0 0 1 8.4 8.5z"/>',
  spend: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  contract: '<path d="M7 2h7l5 5v15H7z"/><path d="M9 13h6M9 17h6M9 9h2"/>',
  compliance: '<circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/>',
  risk: '<path d="M12 2 2 20h20L12 2z"/><path d="M12 9v5M12 17h.01"/>',
  knowledge:
    '<path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2.5"/><path d="M6 21h13"/>',
  exec: '<rect x="4" y="4" width="16" height="14" rx="3"/><path d="M9 21h6"/>',
  finance:
    '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.2c0-1.2 1.1-2 2.5-2s2.5.9 2.5 2c0 2.5-5 1.7-5 4.2 0 1.1 1.1 2 2.5 2s2.5-.8 2.5-2"/>',
  lock: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  chevron: '<path d="M15 18l-6-6 6-6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  sparkles:
    '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3"/>',
  layout:
    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  wand: '<path d="M15 4V2M15 16v-2M8 9H6M24 9h-2M12.5 6.5l-1.5-1.5M19.5 13.5 18 12M5 19l9-9 3 3-9 9H5z"/>',
};

export type IconName = keyof typeof paths;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 18, className, style }: IconProps) {
  const inner = paths[name] ?? paths.doc;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className={className}
      style={style}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

// Navigation icon mapping (icon rail -> icon name).
export const railIcons: Record<string, IconName> = {
  dashboard: 'grid',
  procurement: 'cart',
  finance: 'finance',
  supplier: 'building',
  governance: 'shield',
  copilot: 'robot',
};
