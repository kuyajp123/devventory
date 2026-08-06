import { Button } from '@heroui/react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { DevventoryDialog } from './DevventoryDialog';
import { DialogBody } from './DialogBody';
import { DialogFooter } from './DialogFooter';
import { DialogHeader } from './DialogHeader';

interface ConfirmDialogProps {
  body?: string | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: () => void;
  title: string;
  variant?: 'danger';
}

export function ConfirmDialog({
  body,
  isOpen,
  onOpenChange,
  onConfirm,
  title,
  variant = 'danger',
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <DevventoryDialog isOpen={isOpen} onOpenChange={onOpenChange} size="sm">
      <DialogHeader
        icon={
          <IconAlertTriangle
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
            className="text-danger"
          />
        }
        title={title}
      />
      <DialogBody>
        {body != null && <p className="text-sm text-foreground">{body}</p>}
      </DialogBody>
      <DialogFooter>
        <Button
          onPress={() => onOpenChange(false)}
          variant="secondary"
          size="sm"
        >
          Cancel
        </Button>
        <Button onPress={handleConfirm} variant={variant} size="sm">
          Confirm
        </Button>
      </DialogFooter>
    </DevventoryDialog>
  );
}
