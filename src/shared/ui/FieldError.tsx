import type { ReactNode } from 'react';

interface FieldErrorProps {
  children: ReactNode;
  className?: string;
}

export function FieldError({ children, className = '' }: FieldErrorProps) {
  return <div className={`text-xs text-danger ${className}`}>{children}</div>;
}
