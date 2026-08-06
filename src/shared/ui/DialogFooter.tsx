import { Modal } from '@heroui/react';
import type { ReactNode } from 'react';

interface DialogFooterProps {
  children: ReactNode;
  className?: string;
}

export function DialogFooter({ children, className = '' }: DialogFooterProps) {
  return (
    <Modal.Footer
      className={`flex shrink-0 items-center justify-end gap-2 border-t border-divider px-4 py-3 ${className}`}
    >
      {children}
    </Modal.Footer>
  );
}
