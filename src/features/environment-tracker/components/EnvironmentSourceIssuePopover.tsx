import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { Button, Popover } from '@heroui/react';
import {
  IconAlertTriangle,
  IconInfoCircle,
  IconMapPin,
} from '@tabler/icons-react';
import {
  sourceStatusLabel,
  type EnvironmentSource,
} from '../models/environment';

interface EnvironmentSourceIssuePopoverProps {
  isOpen: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  source: EnvironmentSource;
}

export function EnvironmentSourceIssuePopover({
  isOpen,
  onOpenChange,
  source,
}: EnvironmentSourceIssuePopoverProps) {
  const status = sourceStatusLabel(source.parseStatus);
  const lineLabel = source.lastIssueLine
    ? `Line ${source.lastIssueLine.toLocaleString()}`
    : 'File-level issue';

  return (
    <Popover isOpen={isOpen} onOpenChange={onOpenChange}>
      <Button
        aria-label={`Explain ${status.toLowerCase()} for ${source.relativePath}`}
        className="h-7 shrink-0 gap-1.5 px-2 font-medium text-warning"
        size="sm"
        variant="ghost"
      >
        <IconAlertTriangle
          aria-hidden="true"
          size={ICON_SIZE.small}
          stroke={ICON_STROKE}
        />
        {status}
      </Button>
      <Popover.Content
        className="w-[min(22rem,calc(100vw-2rem))]"
        offset={8}
        placement="bottom end"
      >
        <Popover.Arrow />
        <Popover.Dialog className="space-y-3 p-4">
          <Popover.Heading className="text-sm font-semibold text-foreground">
            Why Devventory could not parse this file
          </Popover.Heading>

          <div className="flex min-w-0 items-start gap-2 text-xs text-muted">
            <IconMapPin
              aria-hidden="true"
              className="mt-0.5 shrink-0"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
            <div className="min-w-0">
              <p className="break-all font-mono text-foreground">
                {source.relativePath}
              </p>
              <p className="mt-1 font-medium text-warning">{lineLabel}</p>
            </div>
          </div>

          <p className="text-sm leading-5 text-foreground">
            {source.lastIssueMessage ??
              'This configuration source needs attention before it can be tracked.'}
          </p>

          <div className="border-t border-divider pt-3">
            <p className="text-sm font-medium text-foreground">How to fix it</p>
            <p className="mt-1 text-sm leading-5 text-muted">
              {sourceIssueGuidance(source.lastIssueCode)}
            </p>
          </div>

          <div className="flex items-start gap-2 border-t border-divider pt-3 text-xs leading-5 text-muted">
            <IconInfoCircle
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-accent"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
            <p>
              Configuration values remain hidden and are never saved. Devventory
              only records key names and structural line metadata.
            </p>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function sourceIssueGuidance(issueCode: string | null): string {
  switch (issueCode) {
    case 'invalid_assignment':
      return 'Use KEY=value on every non-empty line. Keep JSON and private keys on one physical line, using escaped \\n characters for line breaks.';
    case 'invalid_key':
      return 'Start the key with a letter or underscore, then use only letters, numbers, and underscores.';
    case 'invalid_encoding':
      return 'Save the file as UTF-8 plain text, then refresh this environment.';
    case 'line_too_long':
      return 'Shorten the affected assignment or move oversized structured content to a separate file referenced by an environment key.';
    case 'source_too_large':
      return 'Reduce the configuration source below 1 MiB or split it into smaller source files.';
    default:
      return 'Correct the reported file structure, save the file, then refresh this environment.';
  }
}
