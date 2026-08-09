import { Button, Spinner } from '@heroui/react';
import { IconDeviceFloppy, IconLayersLinked } from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  DevventoryDialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '@/shared/ui';
import { useAssetVariantManager } from '../hooks/use-asset-variant-manager';
import type { Asset } from '../models/asset';
import { ManualVariantPathField } from './ManualVariantPathField';
import { SelectedVariantsPanel } from './SelectedVariantsPanel';
import { VariantCandidateBrowser } from './VariantCandidateBrowser';

interface AssetVariantManagerModalProps {
  asset: Asset;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function AssetVariantManagerModal({
  asset,
  isOpen,
  onOpenChange,
}: AssetVariantManagerModalProps) {
  const manager = useAssetVariantManager(asset);

  function close() {
    manager.cancel();
    onOpenChange(false);
  }

  async function save() {
    const updated = await manager.save();
    if (updated) onOpenChange(false);
  }

  return (
    <DevventoryDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) manager.cancel();
        onOpenChange(open);
      }}
      size="3xl"
    >
      <DialogHeader
        description={`Current file: ${asset.relativePath}`}
        icon={
          <IconLayersLinked
            aria-hidden="true"
            size={ICON_SIZE.navigation}
            stroke={ICON_STROKE}
          />
        }
        title="Manage variants"
      />
      <DialogBody className="min-h-0 p-0">
        <div className="grid h-full min-h-0 grid-cols-1 sm:grid-cols-[minmax(0,1fr)_18rem] md:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-h-0 overflow-y-auto p-4">
            <VariantCandidateBrowser
              data={manager.candidates.data}
              isError={manager.candidates.isError}
              isFetching={manager.candidates.isFetching}
              isPending={
                manager.candidates.isPending || manager.persisted.isPending
              }
              onAdd={manager.add}
              onPageChange={manager.setPage}
              onScopeChange={manager.setScope}
              onSearchChange={manager.setSearch}
              page={manager.page}
              scope={manager.scope}
              search={manager.search}
            />
            <div className="mt-4">
              <ManualVariantPathField
                error={manager.manualError}
                isPending={manager.resolvePath.isPending}
                onAdd={() => void manager.addManualPath()}
                onChange={manager.setManualPath}
                suggestions={manager.autocomplete.data?.items ?? []}
                value={manager.manualPath}
              />
            </div>
          </div>
          <div className="min-h-64 border-t border-divider lg:border-l lg:border-t-0">
            <SelectedVariantsPanel
              onRemove={manager.remove}
              variants={manager.selected}
            />
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button
          isDisabled={manager.updateVariants.isPending}
          onPress={close}
          size="sm"
          variant="secondary"
        >
          Cancel
        </Button>
        <Button
          isDisabled={
            manager.persisted.isPending || manager.updateVariants.isPending
          }
          onPress={() => void save()}
          size="sm"
          variant="primary"
        >
          {manager.updateVariants.isPending ? (
            <Spinner aria-label="Saving asset variants" size="sm" />
          ) : (
            <IconDeviceFloppy
              aria-hidden="true"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
          )}
          Save variants
        </Button>
      </DialogFooter>
    </DevventoryDialog>
  );
}
