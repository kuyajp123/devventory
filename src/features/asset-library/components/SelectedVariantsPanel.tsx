import { Button, Chip } from '@heroui/react';
import { IconLayersLinked, IconX } from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import type { VariantCandidate } from '../models/asset';

export function SelectedVariantsPanel({
  onRemove,
  variants,
}: {
  onRemove: (id: string) => void;
  variants: VariantCandidate[];
}) {
  return (
    <section
      aria-label="Selected variants"
      className="flex min-h-0 flex-col bg-sidebar"
    >
      <header className="flex items-center gap-2 border-b border-divider px-4 py-3">
        <IconLayersLinked
          aria-hidden="true"
          className="text-accent"
          size={ICON_SIZE.button}
          stroke={ICON_STROKE}
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Selected variants</h3>
          <p className="text-xs text-muted">Saved when you confirm.</p>
        </div>
        <Chip size="sm" variant={variants.length > 0 ? 'primary' : 'soft'}>
          <Chip.Label>{variants.length}/20</Chip.Label>
        </Chip>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {variants.length > 0 ? (
          <ul className="space-y-2">
            {variants.map((variant) => (
              <li
                className="group flex items-center gap-2 rounded-sm border border-divider bg-surface px-3 py-2"
                key={variant.id}
              >
                <IconLayersLinked
                  aria-hidden="true"
                  className="shrink-0 text-muted"
                  size={ICON_SIZE.small}
                  stroke={ICON_STROKE}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{variant.name}</p>
                  <p className="truncate font-mono text-[11px] text-muted">
                    {variant.relativePath}
                  </p>
                </div>
                <Button
                  aria-label={`Remove ${variant.relativePath}`}
                  className="shrink-0"
                  isIconOnly
                  onPress={() => onRemove(variant.id)}
                  size="sm"
                  variant="ghost"
                >
                  <IconX
                    aria-hidden="true"
                    size={ICON_SIZE.small}
                    stroke={ICON_STROKE}
                  />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex h-full min-h-48 flex-col items-center justify-center px-4 text-center text-muted">
            <IconLayersLinked
              aria-hidden="true"
              className="opacity-40"
              size={ICON_SIZE.emptyState}
              stroke={ICON_STROKE}
            />
            <p className="mt-3 text-sm font-medium text-foreground">
              No variants selected
            </p>
            <p className="mt-1 max-w-48 text-xs">
              Add candidates or enter an indexed project-relative path.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
