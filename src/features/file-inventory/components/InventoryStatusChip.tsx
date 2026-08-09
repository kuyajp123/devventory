import { SemanticStatusChip } from '@/shared/ui';
import type { FileStatus } from '../models/file-inventory';

export function InventoryStatusChip({
  status,
}: {
  status: 'available' | FileStatus;
}) {
  const isAvailable = status !== 'missing';

  return (
    <SemanticStatusChip
      dataStatus={status}
      label={statusLabel(status)}
      tone={isAvailable ? 'success' : 'warning'}
    />
  );
}

function statusLabel(status: 'available' | FileStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'missing':
      return 'Missing';
    default:
      return 'Available';
  }
}
