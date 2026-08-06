import { Label } from '@heroui/react';
import type { ReactNode } from 'react';

interface FormFieldProps {
  children: ReactNode;
  className?: string;
  error?: ReactNode;
  for?: string;
  hint?: ReactNode;
  isOptional?: boolean;
  label: string;
}

export function FormField({
  children,
  className = '',
  error,
  for: htmlFor,
  hint,
  isOptional = false,
  label,
}: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center gap-1.5">
        <Label
          className="text-xs font-medium text-foreground"
          htmlFor={htmlFor}
        >
          {label}
        </Label>
        {isOptional && <span className="text-xs text-muted">(optional)</span>}
      </div>
      {children}
      {hint && <div className="text-xs text-muted">{hint}</div>}
      {error && <div className="text-xs text-danger">{error}</div>}
    </div>
  );
}
