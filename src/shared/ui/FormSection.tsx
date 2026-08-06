import type { ReactNode } from 'react';

interface FormSectionProps {
  children: ReactNode;
  className?: string;
  label?: string;
}

export function FormSection({
  children,
  className = '',
  label,
}: FormSectionProps) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {label && (
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          {label}
        </h3>
      )}
      {children}
    </div>
  );
}
