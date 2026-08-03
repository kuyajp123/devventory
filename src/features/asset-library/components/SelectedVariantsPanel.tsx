import { useEffect, useRef, useState } from 'react';
import { Button, Chip } from '@heroui/react';
import {
  IconChevronDown,
  IconChevronUp,
  IconLayersLinked,
  IconX,
} from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import type { VariantCandidate } from '../models/asset';

export function SelectedVariantsPanel({
  onRemove,
  variants,
}: {
  onRemove: (id: string) => void;
  variants: VariantCandidate[];
}) {
  const [expanded, setExpanded] = useState(false);
  const previousCount = useRef(0);
  const count = variants.length;

  // Auto-expand when variants are first populated (e.g. persisted data loads)
  useEffect(() => {
    if (previousCount.current === 0 && count > 0) {
      setExpanded(true);
    }
    previousCount.current = count;
  }, [count]);

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col"
      style={{ maxWidth: 'min(26rem, calc(100vw - 2rem))' }}
    >
      {/* Expanded file list — conditionally rendered for accessibility */}
      {expanded && (
        <div className="max-h-80 overflow-y-auto rounded-t-2xl border border-b-0 border-default bg-surface p-3 shadow-xl">
          {count > 0 ? (
            <ul className="space-y-1.5">
              {variants.map((variant) => (
                <li
                  className="group flex items-center gap-2.5 rounded-xl border border-default/60 bg-surface-secondary/50 p-2.5 transition-colors hover:border-accent/30 hover:bg-accent/5"
                  key={variant.id}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <IconLayersLinked
                      aria-hidden="true"
                      size={ICON_SIZE.small}
                      stroke={ICON_STROKE}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">
                      {variant.name}
                    </p>
                    <p className="truncate font-mono text-xs leading-tight text-muted">
                      {variant.relativePath}
                    </p>
                  </div>
                  <Button
                    aria-label={`Remove ${variant.relativePath}`}
                    className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
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
            <div className="py-6 text-center text-muted">
              <IconLayersLinked
                aria-hidden="true"
                className="mx-auto opacity-40"
                size={ICON_SIZE.emptyState}
                stroke={ICON_STROKE}
              />
              <p className="mt-2 text-sm font-medium text-foreground">
                No variants selected
              </p>
              <p className="mt-0.5 text-xs">
                Add files from the browser or by path.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Collapsed trigger bar */}
      <button
        aria-expanded={expanded}
        aria-label={`Selected variants, ${count} files`}
        className={`flex w-full cursor-pointer items-center gap-2.5 border border-default bg-surface px-4 py-3 shadow-xl transition-all duration-200 hover:bg-surface-secondary ${
          expanded ? 'rounded-b-2xl border-t-0' : 'rounded-2xl'
        }`}
        onClick={() => setExpanded((prev) => !prev)}
        type="button"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <IconLayersLinked
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
        </div>
        <span className="text-sm font-semibold">Selected variants</span>
        <Chip
          className="ml-auto"
          size="sm"
          variant={count > 0 ? 'primary' : 'soft'}
        >
          <Chip.Label>{count}/20</Chip.Label>
        </Chip>
        {expanded ? (
          <IconChevronDown
            aria-hidden="true"
            className="text-muted"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
        ) : (
          <IconChevronUp
            aria-hidden="true"
            className="text-muted"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
        )}
      </button>
    </div>
  );
}
