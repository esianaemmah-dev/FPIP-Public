import { useLocation, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from './Icons';
import { classNames } from '@/lib/format';

interface RailItem {
  key: string;
  path: string;
  icon: IconName;
  label: string;
  twoLine?: boolean;
}

const items: RailItem[] = [
  { key: 'dashboard', path: '/dashboard', icon: 'grid', label: 'Command Center', twoLine: true },
  { key: 'procurement', path: '/procurement', icon: 'cart', label: 'Procurement' },
  { key: 'finance', path: '/finance', icon: 'finance', label: 'Finance' },
  { key: 'supplier', path: '/supplier', icon: 'building', label: 'Supplier Portal', twoLine: true },
  { key: 'governance', path: '/governance', icon: 'shield', label: 'Governance & Audit', twoLine: true },
  { key: 'copilot', path: '/copilot', icon: 'robot', label: 'AI Copilot' },
];

function splitLabel(label: string): [string, string] {
  const parts = label.split(' ');
  return [parts[0], parts.slice(1).join(' ')];
}

export function IconRail() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <div className="rail">
      <div className="rail-logo">F</div>
      {items.map((it) => {
        const active = pathname === it.path || pathname.startsWith(`${it.path}/`);
        const [first, rest] = it.twoLine ? splitLabel(it.label) : [it.label, ''];
        return (
          <button
            key={it.key}
            type="button"
            className={classNames('rail-btn', active && 'active')}
            title={it.label}
            onClick={() => navigate(it.path)}
          >
            <Icon name={it.icon} size={18} />
            <span>
              {first}
              {it.twoLine ? <br /> : null}
              {rest}
            </span>
          </button>
        );
      })}
      <div className="rail-spacer" />
    </div>
  );
}
