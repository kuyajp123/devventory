import { formatFileSize } from '@/features/file-inventory';
import { useActiveProject } from '@/features/projects';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { Alert, Card, Chip, Skeleton } from '@heroui/react';
import { IconArrowLeft, IconHeartFilled } from '@tabler/icons-react';
import { Link, useParams } from 'react-router';
import { AssetMetadataForm } from '../components/AssetMetadataForm';
import { AssetQuickActions } from '../components/AssetQuickActions';
import { AssetVariantManager } from '../components/AssetVariantManager';
import { useAssetQuery } from '../hooks/use-assets';

export function AssetDetailsPage() {
  const { assetId = '' } = useParams();
  const { activeProjectId: projectId, isHydrating } = useActiveProject();
  const asset = useAssetQuery(projectId ?? '', assetId);

  if (isHydrating || asset.isPending) {
    return (
      <div
        aria-label="Loading asset"
        className="mx-auto max-w-5xl space-y-4"
        role="status"
      >
        <Skeleton className="h-10 w-2/5 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }
  if (!projectId || asset.isError || !asset.data) {
    return (
      <Alert role="alert" status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Asset unavailable</Alert.Title>
          <Alert.Description>
            The asset record could not be loaded for the active project.
          </Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  const data = asset.data;
  return (
    <section className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-4">
        <Link
          className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
          to="/assets"
        >
          <IconArrowLeft
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
          Back to asset library
        </Link>
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Chip size="sm" variant="soft">
                <Chip.Label className="capitalize">{data.origin}</Chip.Label>
              </Chip>
              {data.favorite && (
                <IconHeartFilled
                  aria-label="Favorite"
                  className="text-danger"
                  size={ICON_SIZE.button}
                />
              )}
            </div>
            <h1 className="mt-1 break-words text-3xl font-semibold tracking-tight sm:text-4xl">
              {data.name}
            </h1>
            <p className="mt-2 break-all font-mono text-xs text-muted">
              {data.relativePath}
            </p>
          </div>
        </div>
      </header>

      <Card>
        <Card.Header className="border-b pb-4 border-default">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Card.Title>Indexed file metadata</Card.Title>
            <AssetQuickActions assetId={data.id} projectId={projectId} />
          </div>
        </Card.Header>
        <Card.Content className="pt-5">
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Metadata label="Category" value={data.category} />
            <Metadata label="Size" value={formatFileSize(data.sizeBytes)} />
            <Metadata
              label="Extension"
              value={data.extension ? `.${data.extension}` : 'None'}
            />
            <Metadata label="Status" value={data.status} />
            <div className="sm:col-span-2 lg:col-span-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                MIME type
              </dt>
              <dd className="mt-1 break-all text-sm">
                {data.mimeType ?? 'Unavailable'}
              </dd>
            </div>
          </dl>
        </Card.Content>
      </Card>

      <AssetMetadataForm asset={data} />
      <AssetVariantManager asset={data} />
    </section>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm capitalize">{value}</dd>
    </div>
  );
}
