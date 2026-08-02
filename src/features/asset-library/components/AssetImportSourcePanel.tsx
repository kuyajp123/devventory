import { Alert, Button, Card, Chip, Spinner } from '@heroui/react';
import { IconFolderOpen } from '@tabler/icons-react';
import { Link } from 'react-router';
import { formatFileSize } from '@/features/file-inventory';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import type { AssetPreview } from '../models/asset';

export function AssetImportSourcePanel({
  isBusy,
  isPreviewing,
  onChoose,
  preview,
  projectId,
  sourcePath,
}: {
  isBusy: boolean;
  isPreviewing: boolean;
  onChoose: () => void;
  preview?: AssetPreview;
  projectId: string;
  sourcePath: string | null;
}) {
  return (
    <>
      <div>
        <Button isDisabled={isBusy} onPress={onChoose} variant="secondary">
          <IconFolderOpen
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
          {sourcePath ? 'Choose another file' : 'Choose source file'}
        </Button>
        {sourcePath && (
          <p className="mt-2 break-all font-mono text-xs text-muted">
            {sourcePath}
          </p>
        )}
      </div>

      {isPreviewing && (
        <span
          className="flex items-center gap-2 text-sm text-muted"
          role="status"
        >
          <Spinner size="sm" /> Inspecting file metadata…
        </span>
      )}
      {preview && (
        <AssetImportPreviewCard preview={preview} projectId={projectId} />
      )}
    </>
  );
}

function AssetImportPreviewCard({
  preview,
  projectId,
}: {
  preview: AssetPreview;
  projectId: string;
}) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>{preview.name}</Card.Title>
        <Card.Description>Safe metadata preview</Card.Description>
      </Card.Header>
      <Card.Content className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Chip size="sm" variant="soft">
            <Chip.Label className="capitalize">{preview.category}</Chip.Label>
          </Chip>
          <Chip size="sm" variant="soft">
            <Chip.Label>{formatFileSize(preview.sizeBytes)}</Chip.Label>
          </Chip>
          {preview.extension && (
            <Chip size="sm" variant="soft">
              <Chip.Label>.{preview.extension}</Chip.Label>
            </Chip>
          )}
        </div>
        {preview.duplicate && (
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Identical content already indexed</Alert.Title>
              <Alert.Description>
                Matching asset: {preview.duplicate.relativePath}.{' '}
                <Link
                  className="font-medium text-accent hover:underline"
                  to={`/projects/${projectId}/assets/${preview.duplicate.assetId}`}
                >
                  Review match
                </Link>
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}
      </Card.Content>
    </Card>
  );
}
