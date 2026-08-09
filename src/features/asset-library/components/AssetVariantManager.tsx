import { Button, Card, Chip } from '@heroui/react';
import { IconLayersLinked } from '@tabler/icons-react';
import { useState } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import type { Asset } from '../models/asset';
import { AssetVariantManagerModal } from './AssetVariantManagerModal';

export function AssetVariantManager({ asset }: { asset: Asset }) {
  const [isOpen, setOpen] = useState(false);

  return (
    <>
      <Card>
        <Card.Header className="border-b border-divider">
          <div className="flex w-full items-start justify-between gap-3">
            <div>
              <Card.Title>Variants</Card.Title>
              <Card.Description>
                Relate alternate sizes, formats, and presentations without
                modifying their file contents.
              </Card.Description>
            </div>
            <Chip size="sm" variant="soft">
              <Chip.Label>{asset.variantIds.length}</Chip.Label>
            </Chip>
          </div>
        </Card.Header>
        <Card.Footer className="justify-end">
          <Button onPress={() => setOpen(true)} variant="secondary">
            <IconLayersLinked
              aria-hidden="true"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
            Manage variants
          </Button>
        </Card.Footer>
      </Card>
      {isOpen && (
        <AssetVariantManagerModal asset={asset} isOpen onOpenChange={setOpen} />
      )}
    </>
  );
}
