import { Button, Surface } from '@heroui/react';
import { IconFileImport } from '@tabler/icons-react';
import { useEffect } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { assetLibraryGateway } from '../services/asset-library.gateway';

export function AssetDropZone({
  onChoose,
  onDrop,
}: {
  onChoose: () => void;
  onDrop: (path: string) => void;
}) {
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void assetLibraryGateway
      .subscribeToFileDrops((path) => {
        if (!disposed) onDrop(path);
      })
      .then((nextUnlisten) => {
        if (disposed) nextUnlisten();
        else unlisten = nextUnlisten;
      })
      .catch(() => {
        // Browser-only previews do not expose the native window API.
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [onDrop]);

  return (
    <Surface
      className="rounded-md border border-dashed border-divider p-5"
      variant="secondary"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <IconFileImport
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-accent"
            size={ICON_SIZE.navigation}
            stroke={ICON_STROKE}
          />
          <div>
            <h2 className="font-semibold">Drop a file into this window</h2>
            <p className="mt-1 text-sm text-muted">
              Or choose a file with the native picker. The file is only copied
              after you review it.
            </p>
          </div>
        </div>
        <Button onPress={onChoose} type="button" variant="secondary">
          Choose file
        </Button>
      </div>
    </Surface>
  );
}
