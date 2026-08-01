interface SealProps {
  size?: 'sm' | 'lg';
  label?: string;
}

export function Seal({ size = 'sm', label = 'F' }: SealProps) {
  return <div className={`seal${size === 'lg' ? ' seal-lg' : ''}`}>{label}</div>;
}
