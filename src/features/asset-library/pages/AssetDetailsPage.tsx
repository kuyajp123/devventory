import { Alert, Card, Chip, Skeleton } from '@heroui/react';
import {
  IconArrowLeft,
  IconFileDescription,
  IconHeartFilled,
} from '@tabler/icons-react';
import { Link, useParams } from 'react-router';
import { formatFileSize } from '@/features/file-inventory';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { AssetMetadataForm } from '../components/AssetMetadataForm';
import { AssetQuickActions } from '../components/AssetQuickActions';
import { useAssetQuery, useAssetsQuery } from '../hooks/use-assets';

export function AssetDetailsPage() {
  const { assetId = '', projectId = '' } = useParams();
  const asset = useAssetQuery(projectId, assetId);
  const candidates = useAssetsQuery(projectId, {
    page: 1,
    pageSize: 100,
    sortBy: 'relativePath',
    sortDirection: 'ascending',
  });

  if (asset.isPending) {
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
  if (asset.isError || !asset.data) {
    return (
      <Alert role="alert" status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Asset unavailable</Alert.Title>
          <Alert.Description>
            The asset record could not be loaded from local storage.
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
          to={`/projects/${projectId}/assets`}
        >
          <IconArrowLeft
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
          Back to asset library
        </Link>
        <div className="flex items-start gap-3">
          <IconFileDescription
            aria-hidden="true"
            className="mt-1 shrink-0 text-accent"
            size={ICON_SIZE.emptyState}
            stroke={ICON_STROKE}
          />
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
        <Card.Header>
          <Card.Title>Indexed file metadata</Card.Title>
        </Card.Header>
        <Card.Content>
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

      <AssetMetadataForm
        asset={data}
        candidates={(candidates.data?.items ?? []).filter(
          (candidate) => candidate.id !== data.id,
        )}
      />
      <AssetQuickActions assetId={data.id} projectId={projectId} />
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
