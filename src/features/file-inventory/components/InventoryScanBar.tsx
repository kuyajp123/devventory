import { Button, Spinner } from '@heroui/react';
import {
  IconCheck,
  IconExclamationMark,
  IconFile,
  IconFolder,
  IconRefresh,
} from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import type { ScanRun } from '../models/file-inventory';

interface InventoryScanBarProps {
  directoriesVisited: number | undefined;
  fileCount: number;
  isScanning: boolean;
  latestScan: ScanRun | undefined;
  onRescanProject: () => void;
}

export function InventoryScanBar({
  directoriesVisited,
  fileCount,
  isScanning,
  latestScan,
  onRescanProject,
}: InventoryScanBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-divider bg-surface px-3 py-2 text-xs">
      <span className="flex items-center gap-1.5 text-secondary">
        <IconFile aria-hidden="true" size={14} />
        <span className="font-mono font-medium text-foreground">
          {fileCount.toLocaleString()}
        </span>{' '}
        files
      </span>
      {directoriesVisited !== undefined && (
        <span className="flex items-center gap-1.5 text-secondary">
          <IconFolder aria-hidden="true" size={14} />
          <span className="font-mono font-medium text-foreground">
            {directoriesVisited.toLocaleString()}
          </span>{' '}
          directories scanned
        </span>
      )}

      {latestScan && (
        <>
          <span className="hidden h-3 w-px bg-divider sm:block" />
          <ScanStatus scan={latestScan} />
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button
          isDisabled={isScanning}
          onPress={onRescanProject}
          size="sm"
          variant="secondary"
        >
          {isScanning ? (
            <Spinner aria-label="Scanning" size="sm" />
          ) : (
            <IconRefresh
              aria-hidden="true"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
          )}
          {isScanning ? 'Scanning…' : 'Rescan project'}
        </Button>
      </div>
    </div>
  );
}

function ScanStatus({ scan }: { scan: ScanRun }) {
  const isOk = scan.status === 'completed';
  const timeAgo = formatTimeAgo(scan.completedAt ?? scan.startedAt);

  return (
    <span className="flex items-center gap-1.5">
      {isOk ? (
        <IconCheck aria-hidden="true" className="text-success" size={14} />
      ) : (
        <IconExclamationMark
          aria-hidden="true"
          className="text-warning"
          size={14}
        />
      )}
      <span className={isOk ? 'text-success' : 'text-warning'}>
        {isOk ? 'Scan complete' : `Scan ${scan.status}`}
      </span>
      <span className="text-muted">·</span>
      <span className="text-muted">{timeAgo}</span>
    </span>
  );
}

function formatTimeAgo(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return '';
  const secondsAgo = Math.max(
    0,
    Math.floor((Date.now() - parsed.getTime()) / 1000),
  );

  if (secondsAgo < 60) return 'just now';
  if (secondsAgo < 3600) {
    const minutes = Math.floor(secondsAgo / 60);
    return `${minutes}m ago`;
  }
  if (secondsAgo < 86400) {
    const hours = Math.floor(secondsAgo / 3600);
    return `${hours}h ago`;
  }
  const days = Math.floor(secondsAgo / 86400);
  return `${days}d ago`;
}
