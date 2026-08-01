import type { CSSProperties, ReactNode } from 'react';
import { classNames } from '@/lib/format';

interface CardProps {
  children: ReactNode;
  className?: string;
  flush?: boolean;
  id?: string;
  style?: CSSProperties;
}

export function Card({ children, className, flush, id, style }: CardProps) {
  return (
    <div id={id} className={classNames('card', flush && 'card-flush', className)} style={style}>
      {children}
    </div>
  );
}

interface SectionHeadProps {
  title: string;
  action?: ReactNode;
}

export function SectionHead({ title, action }: SectionHeadProps) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {action}
    </div>
  );
}
