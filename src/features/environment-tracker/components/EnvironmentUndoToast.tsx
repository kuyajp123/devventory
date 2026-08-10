import { Button } from '@heroui/react';
import { IconArrowBackUp, IconTrash } from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';

interface EnvironmentUndoToastProps {
  environmentName: string;
  onUndo: () => void;
  secondsRemaining: number;
}

export function EnvironmentUndoToast({
  environmentName,
  onUndo,
  secondsRemaining,
}: EnvironmentUndoToastProps) {
  return (
    <div
      aria-live="assertive"
      aria-atomic="true"
      aria-label={`Environment ${environmentName} deleted. Click Undo to restore within ${secondsRemaining} seconds.`}
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-divider bg-surface-secondary/95 px-4 py-2.5 shadow-xl backdrop-blur transition-all animate-in fade-in slide-in-from-bottom-3 duration-200"
      role="status"
    >
      <div className="flex items-center gap-2">
        <IconTrash
          aria-hidden="true"
          className="shrink-0 text-danger"
          size={ICON_SIZE.small}
          stroke={ICON_STROKE}
        />
        <span className="text-xs font-medium text-foreground">
          Environment{' '}
          <span className="font-mono font-semibold">"{environmentName}"</span>{' '}
          deleted
        </span>
        <span className="font-mono text-xs text-muted">
          ({secondsRemaining}s)
        </span>
      </div>
      <Button
        aria-label={`Undo deletion of ${environmentName}`}
        onPress={onUndo}
        size="sm"
        variant="secondary"
      >
        <IconArrowBackUp
          aria-hidden="true"
          size={ICON_SIZE.small}
          stroke={ICON_STROKE}
        />
        Undo
      </Button>
    </div>
  );
}
