import { IconTags } from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { DevventoryDialog, DialogBody, DialogHeader } from '@/shared/ui';
import type { Asset } from '../models/asset';
import { AssetMetadataForm } from './AssetMetadataForm';

export function AssetMetadataDialog({
  asset,
  isOpen,
  onOpenChange,
}: {
  asset: Asset;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <DevventoryDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      scroll
      size="md"
    >
      <DialogHeader
        description={asset.relativePath}
        icon={
          <IconTags
            aria-hidden="true"
            size={ICON_SIZE.navigation}
            stroke={ICON_STROKE}
          />
        }
        title="Edit asset metadata"
      />
      <DialogBody>
        <AssetMetadataForm
          asset={asset}
          embedded
          onSaved={() => onOpenChange(false)}
        />
      </DialogBody>
    </DevventoryDialog>
  );
}
