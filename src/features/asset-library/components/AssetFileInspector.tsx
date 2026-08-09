import { Alert, Button, Chip, Skeleton, Spinner } from '@heroui/react';
import {
  IconEdit,
  IconFile,
  IconHeartFilled,
  IconLayersLinked,
  IconX,
} from '@tabler/icons-react';
import { useState } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  formatFileSize,
  type FileCategory,
} from '@/shared/models/indexed-file';
import { useAssetQuery, useAssetVariantsQuery } from '../hooks/use-assets';
import { AssetMetadataDialog } from './AssetMetadataDialog';
import { AssetQuickActions } from './AssetQuickActions';
import { AssetVariantManagerModal } from './AssetVariantManagerModal';

export interface AssetInspectorFile {
  category: FileCategory;
  extension: string | null;
  id: string;
  mimeType: string | null;
  modifiedAtMs: number | null;
  name: string;
  projectId: string;
  relativePath: string;
  sizeBytes: number;
  status: 'active' | 'missing';
}

export function AssetFileInspector({
  file,
  onClose,
}: {
  file: AssetInspectorFile;
  onClose: () => void;
}) {
  const asset = useAssetQuery(file.projectId, file.id);
  const variants = useAssetVariantsQuery(file.projectId, file.id);
  const [isMetadataOpen, setMetadataOpen] = useState(false);
  const [isVariantsOpen, setVariantsOpen] = useState(false);

  return (
    <aside
      aria-label={`File information for ${file.name}`}
      className="sticky top-4 self-start flex h-full max-h-[calc(100vh-2rem)] min-h-0 w-80 shrink-0 flex-col border-l border-divider bg-sidebar rounded-r-md 2xl:w-96"
    >
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-divider px-3">
        <IconFile
          aria-hidden="true"
          className="shrink-0 text-accent"
          size={ICON_SIZE.small}
          stroke={ICON_STROKE}
        />
        <h2 className="min-w-0 flex-1 truncate font-mono text-xs font-semibold">
          {file.name}
        </h2>
        <Button
          aria-label="Close file information"
          isIconOnly
          onPress={onClose}
          size="sm"
          variant="ghost"
        >
          <IconX
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <InspectorSection title="Overview">
          <Definition label="Path" mono value={file.relativePath} />
          <Definition
            label="Type"
            value={(file.extension ?? file.category).toUpperCase()}
          />
          <Definition label="Category" value={capitalize(file.category)} />
          <Definition label="Size" value={formatFileSize(file.sizeBytes)} />
          <Definition
            label="Modified"
            value={formatModified(file.modifiedAtMs)}
          />
          <Definition label="Status" value={capitalize(file.status)} />
        </InspectorSection>

        {asset.isPending && (
          <div
            aria-label="Loading asset information"
            className="space-y-2 p-3"
            role="status"
          >
            <Skeleton className="h-8 w-full rounded-sm" />
            <Skeleton className="h-20 w-full rounded-sm" />
          </div>
        )}

        {asset.isError && (
          <Alert className="m-3" role="alert" status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Asset information unavailable</Alert.Title>
              <Alert.Description>
                The indexed file remains available. Try refreshing the project.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        {asset.data && (
          <>
            <InspectorSection
              action={
                <Button
                  aria-label="Edit metadata"
                  isIconOnly
                  onPress={() => setMetadataOpen(true)}
                  size="sm"
                  variant="ghost"
                >
                  <IconEdit
                    aria-hidden="true"
                    size={ICON_SIZE.small}
                    stroke={ICON_STROKE}
                  />
                </Button>
              }
              title="Asset metadata"
            >
              <Definition
                label="Origin"
                value={
                  asset.data.origin === 'managed' ? 'Managed' : 'Discovered'
                }
              />
              <div className="flex items-start gap-3 text-xs">
                <span className="w-20 shrink-0 text-muted">Favorite</span>
                <span className="flex items-center gap-1 text-foreground">
                  {asset.data.favorite && (
                    <IconHeartFilled
                      aria-hidden="true"
                      className="text-danger"
                      size={ICON_SIZE.small}
                    />
                  )}
                  {asset.data.favorite ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-start gap-3 text-xs">
                <span className="w-20 shrink-0 text-muted">Tags</span>
                <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                  {asset.data.tags.length > 0 ? (
                    asset.data.tags.map((tag) => (
                      <Chip key={tag} size="sm" variant="soft">
                        <Chip.Label>{tag}</Chip.Label>
                      </Chip>
                    ))
                  ) : (
                    <span className="text-muted">None</span>
                  )}
                </div>
              </div>
              <div className="text-xs">
                <p className="text-muted">Note</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-foreground">
                  {asset.data.note ?? 'No note added.'}
                </p>
              </div>
            </InspectorSection>

            <InspectorSection title="Quick actions">
              <AssetQuickActions assetId={file.id} projectId={file.projectId} />
            </InspectorSection>

            <InspectorSection
              action={
                variants.isFetching ? (
                  <Spinner aria-label="Refreshing variants" size="sm" />
                ) : undefined
              }
              title={`Variants (${variants.data?.length ?? asset.data.variantIds.length})`}
            >
              {variants.data && variants.data.length > 0 ? (
                <ul className="space-y-1.5">
                  {variants.data.map((variant) => (
                    <li
                      className="truncate rounded-sm border border-divider bg-surface px-2 py-1.5 font-mono text-[11px]"
                      key={variant.id}
                      title={variant.relativePath}
                    >
                      {variant.relativePath}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">No variants assigned.</p>
              )}
              <Button
                className="w-full"
                onPress={() => setVariantsOpen(true)}
                size="sm"
                variant="secondary"
              >
                <IconLayersLinked
                  aria-hidden="true"
                  size={ICON_SIZE.button}
                  stroke={ICON_STROKE}
                />
                Manage variants
              </Button>
            </InspectorSection>
          </>
        )}
      </div>

      {asset.data && isMetadataOpen && (
        <AssetMetadataDialog
          asset={asset.data}
          isOpen
          onOpenChange={setMetadataOpen}
        />
      )}
      {asset.data && isVariantsOpen && (
        <AssetVariantManagerModal
          asset={asset.data}
          isOpen
          onOpenChange={setVariantsOpen}
        />
      )}
    </aside>
  );
}

function InspectorSection({
  action,
  children,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="space-y-3 border-b border-divider p-3">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Definition({
  label,
  mono = false,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 text-xs">
      <dt className="w-20 shrink-0 text-muted">{label}</dt>
      <dd
        className={`min-w-0 flex-1 break-words text-foreground ${mono ? 'font-mono text-[11px]' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatModified(value: number | null): string {
  if (value === null) return 'Unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
