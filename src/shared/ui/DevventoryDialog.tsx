import { Modal } from '@heroui/react';
import type { ReactNode } from 'react';

interface DevventoryDialogProps {
  children: ReactNode;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  scroll?: boolean;
}

const sizeClasses = {
  sm: 'max-w-[420px]',
  md: 'max-w-[520px]',
  lg: 'max-w-[680px]',
  xl: 'max-w-[860px]',
};

export function DevventoryDialog({
  children,
  isOpen,
  onOpenChange,
  size = 'md',
  scroll = false,
}: DevventoryDialogProps) {
  return (
    <Modal>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        variant="blur"
      >
        <Modal.Container
          className={sizeClasses[size]}
          scroll={scroll ? 'inside' : undefined}
        >
          <Modal.Dialog
            className="flex max-h-[min(80vh,720px)] flex-col overflow-hidden rounded-[4px] border border-divider bg-surface shadow-lg"
            role="dialog"
            aria-modal="true"
          >
            {children}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
