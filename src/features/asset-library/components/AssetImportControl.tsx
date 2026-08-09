import { Button, toast } from '@heroui/react';
import { IconFileImport } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { useSelectAssetSourceMutation } from '../hooks/use-assets';
import { isImportDestinationAllowed } from '../models/asset';
import { assetLibraryGateway } from '../services/asset-library.gateway';
import { AssetImportModal } from './AssetImportModal';

interface AssetImportControlProps {
  destination: string;
  projectId: string;
  watchedLocations: string[];
}

export function AssetImportControl({
  destination,
  projectId,
  watchedLocations,
}: AssetImportControlProps) {
  const picker = useSelectAssetSourceMutation();
  const [isImportOpen, setImportOpen] = useState(false);
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const destinationIsAllowed = isImportDestinationAllowed(
    destination,
    watchedLocations,
  );

  const reviewSource = useCallback(
    (path: string) => {
      if (!destinationIsAllowed) return;
      setSourcePath(path);
      setImportOpen(true);
    },
    [destinationIsAllowed],
  );

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void assetLibraryGateway
      .subscribeToFileDrops((path) => {
        if (!disposed) reviewSource(path);
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
  }, [reviewSource]);

  async function chooseSource() {
    if (!destinationIsAllowed) return;
    try {
      const selected = await picker.mutateAsync();
      if (selected) reviewSource(selected);
    } catch {
      toast.danger('The native file picker is unavailable.');
    }
  }

  function changeImportOpen(open: boolean) {
    setImportOpen(open);
    if (!open) setSourcePath(null);
  }

  const destinationLabel = destination === '.' ? 'project root' : destination;

  return (
    <>
      <span
        title={
          destinationIsAllowed
            ? 'Dropped files will be reviewed before they are copied.'
            : 'Choose a folder inside a watched project location to import here.'
        }
      >
        <Button
          aria-label={`Import to ${destinationLabel}`}
          isDisabled={!destinationIsAllowed || picker.isPending}
          isPending={picker.isPending}
          onPress={() => void chooseSource()}
          size="sm"
          variant="primary"
        >
          <IconFileImport
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
          Import here
        </Button>
      </span>

      {isImportOpen && (
        <AssetImportModal
          initialDestination={destination}
          initialSourcePath={sourcePath}
          isOpen
          key={`${destination}:${sourcePath ?? ''}`}
          onOpenChange={changeImportOpen}
          projectId={projectId}
          watchedLocations={watchedLocations}
        />
      )}
    </>
  );
}
