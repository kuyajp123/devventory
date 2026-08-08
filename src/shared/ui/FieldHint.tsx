import type { ReactNode } from 'react';

interface FieldHintProps {
  children: ReactNode;
  className?: string;
}

export function FieldHint({ children, className = '' }: FieldHintProps) {
  return (
    <div className={`text-xs text-muted-foreground ${className}`}>
      {children}
    </div>
  );
}
