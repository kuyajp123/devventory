import { Button, Chip } from '@heroui/react';
import { IconX } from '@tabler/icons-react';
import { ICON_STROKE } from '@/shared/constants/icon.constants';
import { formatFileSize, type IndexedFile } from '../models/file-inventory';

interface FileDetailsPanelProps {
  file: IndexedFile;
  onClose: () => void;
}

export function FileDetailsPanel({ file, onClose }: FileDetailsPanelProps) {
  return (
    <div className="border-t border-divider bg-surface">
      <div className="flex items-center justify-between border-b border-divider px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate font-mono text-xs font-medium text-foreground">
            {file.name}
          </span>
          <StatusChip status={file.status} />
        </div>
        <Button
          aria-label="Close file details"
          className="h-6 w-6"
          isIconOnly
          onPress={onClose}
          size="sm"
          variant="ghost"
        >
          <IconX aria-hidden="true" size={14} stroke={ICON_STROKE} />
        </Button>
      </div>

      <div className="grid gap-x-6 gap-y-2 p-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
        <DetailRow label="Path" value={file.relativePath} mono />
        <DetailRow label="Extension" value={file.extension ?? 'None'} />
        <DetailRow label="Category" value={capitalize(file.category)} />
        <DetailRow label="Size" value={formatFileSize(file.sizeBytes)} />
        <DetailRow label="Modified" value={formatDate(file.modifiedAtMs)} />
        <DetailRow label="Status" value={capitalize(file.status)} />
        <DetailRow label="MIME" value={file.mimeType ?? 'Unknown'} />
        <DetailRow label="Origin" value={capitalize(file.sourceType)} />
        <DetailRow
          label="First seen"
          value={formatTimestamp(file.firstSeenAt)}
        />
        <DetailRow label="Last seen" value={formatTimestamp(file.lastSeenAt)} />
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-muted">
        {label}
      </dt>
      <dd
        className={`min-w-0 truncate text-foreground ${mono ? 'font-mono' : ''}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function StatusChip({ status }: { status: IndexedFile['status'] }) {
  return (
    <Chip
      color={status === 'active' ? 'success' : 'warning'}
      size="sm"
      variant="soft"
    >
      <Chip.Label className="text-[10px]">
        {status === 'active' ? 'Active' : 'Missing'}
      </Chip.Label>
    </Chip>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value: number | null): string {
  if (value === null) return 'Unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}
