import { Alert, Button, Card, Chip, Spinner } from '@heroui/react';
import { IconDeviceFloppy, IconLayersLinked } from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { useAssetVariantManager } from '../hooks/use-asset-variant-manager';
import type { Asset } from '../models/asset';
import { ManualVariantPathField } from './ManualVariantPathField';
import { SelectedVariantsPanel } from './SelectedVariantsPanel';
import { VariantCandidateBrowser } from './VariantCandidateBrowser';

export function AssetVariantManager({ asset }: { asset: Asset }) {
  const manager = useAssetVariantManager(asset);

  return (
    <>
      <Card>
        <Card.Header className="border-b pb-4 border-default">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-accent">
                <IconLayersLinked
                  aria-hidden="true"
                  size={ICON_SIZE.navigation}
                  stroke={ICON_STROKE}
                />
                <Card.Title>Manage variants</Card.Title>
              </div>
              <Card.Description>
                Choose related files deliberately. Suggestions never create
                links automatically.
              </Card.Description>
            </div>
            <Chip size="sm" variant="soft">
              <Chip.Label className="max-w-full truncate font-mono">
                {asset.relativePath}
              </Chip.Label>
            </Chip>
          </div>
        </Card.Header>
        <Card.Content className="space-y-5 pt-5">
          {manager.persisted.isError && (
            <Alert role="alert" status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Saved variants unavailable</Alert.Title>
                <Alert.Description>
                  Existing relationships could not be loaded safely.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}
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
          <ManualVariantPathField
            error={manager.manualError}
            isPending={manager.resolvePath.isPending}
            onAdd={() => void manager.addManualPath()}
            onChange={manager.setManualPath}
            suggestions={manager.autocomplete.data?.items ?? []}
            value={manager.manualPath}
          />
        </Card.Content>
        <Card.Footer className="justify-end gap-2 border-t pt-4 border-default">
          <Button
            isDisabled={
              manager.persisted.isPending || manager.updateVariants.isPending
            }
            onPress={manager.cancel}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            isDisabled={
              manager.persisted.isPending || manager.updateVariants.isPending
            }
            onPress={() => void manager.save()}
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
        </Card.Footer>
      </Card>

      {/* Floating bottom-left selected-variants drawer */}
      <SelectedVariantsPanel
        onRemove={manager.remove}
        variants={manager.selected}
      />
    </>
  );
}
