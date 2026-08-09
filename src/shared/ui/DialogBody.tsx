import { Modal } from '@heroui/react';
import type { ReactNode } from 'react';

interface DialogBodyProps {
  children: ReactNode;
  className?: string;
  scrollable?: boolean;
}

export function DialogBody({
  children,
  className = '',
  scrollable = true,
}: DialogBodyProps) {
  return (
    <Modal.Body
      className={`flex-1 ${scrollable ? 'overflow-y-auto' : 'overflow-y-visible'} px-4 py-3 ${className}`}
    >
      {children}
    </Modal.Body>
  );
}
