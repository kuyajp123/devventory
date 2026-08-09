import { Chip, EmptyState, Table } from '@heroui/react';
import { IconFileOff, IconHeartFilled } from '@tabler/icons-react';
import { Link } from 'react-router';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { formatFileSize } from '@/shared/models/indexed-file';
import {
  assetSortFieldSchema,
  type Asset,
  type AssetSortField,
  type SortDirection,
} from '../models/asset';

interface AssetTableProps {
  assets: Asset[];
  hasFilters: boolean;
  onSelectAsset?: (asset: Asset) => void;
  onSortChange: (sortBy: AssetSortField, direction: SortDirection) => void;
  selectedAssetId?: string;
  sortBy: AssetSortField;
  sortDirection: SortDirection;
}

export function AssetTable({
  assets,
  hasFilters,
  onSelectAsset,
  onSortChange,
  selectedAssetId,
  sortBy,
  sortDirection,
}: AssetTableProps) {
  if (assets.length === 0) {
    return (
      <EmptyState className="rounded-md border border-dashed border-divider bg-surface p-8 text-center">
        <IconFileOff
          aria-hidden="true"
          className="mx-auto text-muted"
          size={ICON_SIZE.emptyState}
          stroke={ICON_STROKE}
        />
        <h2 className="mt-4 text-lg font-semibold">
          {hasFilters
            ? 'No assets match these filters'
            : 'No assets indexed yet'}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {hasFilters
            ? 'Adjust or reset the filters to see more files.'
            : 'Import a file or run the file inventory scan to get started.'}
        </p>
      </EmptyState>
    );
  }

  return (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content
          aria-label="Project assets"
          onSortChange={(descriptor) => {
            const nextSort = assetSortFieldSchema.safeParse(descriptor.column);
            if (nextSort.success)
              onSortChange(nextSort.data, descriptor.direction);
          }}
          sortDescriptor={{ column: sortBy, direction: sortDirection }}
        >
          <Table.Header>
            <SortableColumn id="relativePath" isRowHeader label="Asset" />
            <SortableColumn id="category" label="Category" />
            <SortableColumn id="sizeBytes" label="Size" />
            <SortableColumn id="modifiedAtMs" label="Modified" />
            <Table.Column id="origin">Origin</Table.Column>
          </Table.Header>
          <Table.Body items={assets}>
            {(asset) => (
              <Table.Row
                className={`${onSelectAsset ? 'cursor-pointer' : ''} ${
                  selectedAssetId === asset.id ? 'bg-accent/5' : ''
                }`}
                id={asset.id}
                onAction={
                  onSelectAsset ? () => onSelectAsset(asset) : undefined
                }
              >
                <Table.Cell className="max-w-lg">
                  <div className="flex min-w-0 items-start gap-2">
                    {asset.favorite && (
                      <IconHeartFilled
                        aria-label="Favorite"
                        className="mt-0.5 shrink-0 text-danger"
                        size={ICON_SIZE.small}
                      />
                    )}
                    <div className="min-w-0">
                      {onSelectAsset ? (
                        <span className="block truncate font-medium text-accent">
                          {asset.name}
                        </span>
                      ) : (
                        <Link
                          className="block truncate font-medium text-accent hover:underline"
                          to={`/assets/${asset.id}`}
                        >
                          {asset.name}
                        </Link>
                      )}
                      <p className="truncate font-mono text-xs text-muted">
                        {asset.relativePath}
                      </p>
                      {asset.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {asset.tags.slice(0, 3).map((tag) => (
                            <Chip key={tag} size="sm" variant="soft">
                              <Chip.Label>{tag}</Chip.Label>
                            </Chip>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell className="capitalize">{asset.category}</Table.Cell>
                <Table.Cell className="whitespace-nowrap">
                  {formatFileSize(asset.sizeBytes)}
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap text-muted">
                  {formatModified(asset.modifiedAtMs)}
                </Table.Cell>
                <Table.Cell>
                  <Chip
                    color={asset.origin === 'managed' ? 'accent' : 'default'}
                    size="sm"
                    variant="soft"
                  >
                    <Chip.Label>
                      {asset.origin === 'managed' ? 'Managed' : 'Discovered'}
                    </Chip.Label>
                  </Chip>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

function SortableColumn({
  id,
  isRowHeader,
  label,
}: {
  id: AssetSortField;
  isRowHeader?: boolean;
  label: string;
}) {
  return (
    <Table.Column allowsSorting id={id} isRowHeader={isRowHeader}>
      {({ sortDirection }) => (
        <Table.SortableColumnHeader sortDirection={sortDirection}>
          {label}
        </Table.SortableColumnHeader>
      )}
    </Table.Column>
  );
}

function formatModified(value: number | null): string {
  if (value === null) return 'Unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
