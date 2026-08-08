import { Modal } from '@heroui/react';
import type { ReactNode } from 'react';

interface DialogHeaderProps {
  children?: ReactNode;
  description?: string;
  icon?: ReactNode;
  title: string;
}

export function DialogHeader({
  children,
  description,
  icon,
  title,
}: DialogHeaderProps) {
  return (
    <Modal.Header className="flex shrink-0 items-start gap-3 px-4 py-3">
      {icon && (
        <div
          className="flex shrink-0 items-center justify-center text-muted"
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Modal.Heading className="text-sm font-semibold text-foreground">
          {title}
        </Modal.Heading>
        {description && <p className="text-xs text-muted">{description}</p>}
        {children}
      </div>
      <Modal.CloseTrigger />
    </Modal.Header>
  );
}
