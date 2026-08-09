import { Modal } from '@heroui/react';
import type { ReactNode } from 'react';

interface DevventoryDialogProps {
  children: ReactNode;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  scroll?: boolean;
}

const sizeMaxWidths: Record<string, string> = {
  sm: '420px',
  md: '520px',
  lg: '680px',
  xl: '860px',
  '2xl': '1080px',
  '3xl': '1240px',
  '4xl': '1400px',
};

export function DevventoryDialog({
  children,
  isOpen,
  onOpenChange,
  size = 'md',
  scroll = false,
}: DevventoryDialogProps) {
  const maxWidth = sizeMaxWidths[size] ?? sizeMaxWidths.md;

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        variant="blur"
      >
        <Modal.Container
          className="w-full !max-w-[calc(100vw-2rem)]"
          scroll={scroll ? 'inside' : undefined}
        >
          <Modal.Dialog
            className="flex w-full flex-col overflow-hidden rounded-[4px] border border-divider bg-surface shadow-lg"
            role="dialog"
            aria-modal="true"
            style={{
              width: '100%',
              maxWidth,
              maxHeight: 'min(85vh, 760px)',
            }}
          >
            {children}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
