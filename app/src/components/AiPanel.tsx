import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icons';

interface AiPanelProps {
  tag: string;
  icon?: IconName;
  children: ReactNode;
  action?: ReactNode;
}

export function AiPanel({ tag, icon = 'robot', children, action }: AiPanelProps) {
  return (
    <div className="ai-panel">
      <div className="ai-tag">
        <Icon name={icon} size={15} />
        {tag}
      </div>
      {children}
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  );
}
