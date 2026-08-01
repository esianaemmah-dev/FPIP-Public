import { Icon, type IconName } from './Icons';

interface AgentIconProps {
  name: IconName;
  size?: number;
}

export function AgentIcon({ name, size }: AgentIconProps) {
  return (
    <div className="agent-icon" style={size ? { width: size, height: size } : undefined}>
      <Icon name={name} size={size ? size - 15 : 19} />
    </div>
  );
}
