import { Modal } from '@heroui/react';
import type { ReactNode } from 'react';

interface DialogBodyProps {
  children: ReactNode;
  className?: string;
}

export function DialogBody({ children, className = '' }: DialogBodyProps) {
  return (
    <Modal.Body className={`flex-1 overflow-y-auto px-4 py-3 ${className}`}>
      {children}
    </Modal.Body>
  );
}
