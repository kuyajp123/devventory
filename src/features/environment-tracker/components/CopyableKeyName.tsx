import { toast, Tooltip } from '@heroui/react';
import { memo, useCallback, useState } from 'react';

interface CopyableKeyNameProps {
  keyName: string;
}

type TooltipState = 'closed' | 'copied' | 'hint';

export const CopyableKeyName = memo(function CopyableKeyName({
  keyName,
}: CopyableKeyNameProps) {
  const [tooltipState, setTooltipState] = useState<TooltipState>('closed');

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(keyName);
      setTooltipState('copied');
    } catch {
      toast.danger('Could not copy key');
    }
  }, [keyName]);

  return (
    <Tooltip
      delay={0}
      isOpen={tooltipState !== 'closed'}
      onOpenChange={(isOpen) => {
        setTooltipState((current) => {
          if (!isOpen) return 'closed';
          return current === 'copied' ? current : 'hint';
        });
      }}
    >
      <Tooltip.Trigger<'button'>
        aria-label={`Copy environment key ${keyName}`}
        className="block w-full cursor-pointer truncate text-left font-mono text-sm font-medium transition-colors hover:text-accent focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onBlur={() => setTooltipState('closed')}
        onClick={copy}
        onFocus={() => setTooltipState('hint')}
        onPointerEnter={() => setTooltipState('hint')}
        onPointerLeave={() => setTooltipState('closed')}
        render={(props) => <button {...props} />}
        type="button"
      >
        {keyName}
      </Tooltip.Trigger>
      <Tooltip.Content placement="top">
        <p aria-live="polite">
          {tooltipState === 'copied'
            ? 'Copied'
            : 'Click to copy environment key'}
        </p>
      </Tooltip.Content>
    </Tooltip>
  );
});
