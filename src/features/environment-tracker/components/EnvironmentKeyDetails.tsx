import { Button, Chip } from '@heroui/react';
import {
  IconAlertTriangle,
  IconFileCode,
  IconInfoCircle,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { SemanticStatusChip } from '@/shared/ui';
import type {
  Environment,
  EnvironmentMatrixSourceDetail,
} from '../models/environment';

export interface EnvironmentKeySelection {
  environment: Environment;
  keyName: string;
  selectedSourcePath?: string;
  sourceDetails: EnvironmentMatrixSourceDetail[];
}

export function EnvironmentKeyDetails({
  onClose,
  onDefinitionClick,
  selection,
}: {
  onClose: () => void;
  onDefinitionClick?: (relativePath: string) => void;
  selection: EnvironmentKeySelection | null;
}) {
  if (!selection) {
    return null;
  }

  return (
    <EnvironmentKeyDetailsContent
      key={`${selection.environment.id}:${selection.keyName}:${selection.selectedSourcePath ?? 'environment'}`}
      onClose={onClose}
      onDefinitionClick={onDefinitionClick}
      selection={selection}
    />
  );
}

function EnvironmentKeyDetailsContent({
  onClose,
  onDefinitionClick,
  selection,
}: {
  onClose: () => void;
  onDefinitionClick?: (relativePath: string) => void;
  selection: EnvironmentKeySelection;
}) {
  const [selectedDefinitionPath, setSelectedDefinitionPath] = useState<
    string | null
  >(selection.selectedSourcePath ?? null);

  const activeDetails = useMemo(
    () => selection.sourceDetails.filter((detail) => !detail.isCommented),
    [selection.sourceDetails],
  );
  const commentedDetails = useMemo(
    () => selection.sourceDetails.filter((detail) => detail.isCommented),
    [selection.sourceDetails],
  );
  const effectiveSelectedSourcePath =
    selection.selectedSourcePath ?? selectedDefinitionPath;
  const selectedSourceDetails = useMemo(
    () =>
      effectiveSelectedSourcePath
        ? selection.sourceDetails.filter(
            (detail) => detail.relativePath === effectiveSelectedSourcePath,
          )
        : selection.sourceDetails,
    [effectiveSelectedSourcePath, selection.sourceDetails],
  );
  const status = effectiveSelectedSourcePath
    ? sourceStatus(selectedSourceDetails)
    : environmentStatus(activeDetails.length, commentedDetails.length);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleDefinitionClick(relativePath: string) {
    setSelectedDefinitionPath(relativePath);
    onDefinitionClick?.(relativePath);
  }

  return (
    <aside className="flex flex-col h-full overflow-y-auto bg-surface border-l border-divider shadow-xl">
      <header className="flex items-start justify-between gap-3 border-b border-divider p-4 sticky top-0 bg-surface z-10">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-semibold">
            {selection.keyName}
          </p>
          <p className="mt-1 text-sm text-muted">
            {selection.environment.name}
            {effectiveSelectedSourcePath
              ? ` · ${effectiveSelectedSourcePath}`
              : ' environment'}
          </p>
        </div>
        <Button
          aria-label="Close key details"
          isIconOnly
          onPress={onClose}
          size="sm"
          variant="ghost"
        >
          <IconX
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
        </Button>
      </header>

      <div className="space-y-5 p-5">
        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Status
          </p>
          <div className="mt-2 flex items-center gap-2">
            {activeDetails.length > 1 && !effectiveSelectedSourcePath ? (
              <IconAlertTriangle
                aria-hidden="true"
                className="text-warning"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
            ) : null}
            <p className="font-semibold">{status}</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">
            {effectiveSelectedSourcePath
              ? sourceExplanation(
                  selectedSourceDetails,
                  effectiveSelectedSourcePath,
                )
              : environmentExplanation(
                  activeDetails.length,
                  commentedDetails.length,
                  selection.environment.name,
                )}
          </p>
        </section>

        <section>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium">Definitions in this environment</h3>
            <Chip size="sm" variant="soft">
              <Chip.Label>{selection.sourceDetails.length}</Chip.Label>
            </Chip>
          </div>
          {selection.sourceDetails.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {selection.sourceDetails.map((detail, index) => {
                const isSelected =
                  effectiveSelectedSourcePath === detail.relativePath;

                return (
                  <li
                    key={`${detail.relativePath}:${detail.lineNumber ?? 'unknown'}:${index}`}
                  >
                    <button
                      aria-pressed={isSelected}
                      className={`w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        isSelected ? 'relative z-10 shadow-sm' : ''
                      } ${
                        onDefinitionClick
                          ? 'cursor-pointer hover:border-accent/60 hover:bg-accent/5'
                          : 'cursor-default'
                      }`}
                      data-definition-path={detail.relativePath}
                      data-selected={isSelected ? 'true' : undefined}
                      onClick={() => handleDefinitionClick(detail.relativePath)}
                      type="button"
                    >
                      <div className="flex items-start gap-3">
                        <IconFileCode
                          aria-hidden="true"
                          className="mt-0.5 shrink-0 text-muted"
                          size={ICON_SIZE.button}
                          stroke={ICON_STROKE}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-sm">
                            {detail.relativePath}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {detail.lineNumber
                              ? `Line ${detail.lineNumber}`
                              : 'Line unavailable'}
                          </p>
                        </div>
                        <SemanticStatusChip
                          dataStatus={
                            detail.isCommented ? 'commented' : 'active'
                          }
                          label={detail.isCommented ? 'Commented' : 'Active'}
                          tone={detail.isCommented ? 'neutral' : 'success'}
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-divider p-4 text-sm text-muted">
              No definition exists in the selected environment or source file.
            </p>
          )}
        </section>

        <div className="flex gap-3 rounded-xl border border-accent/40 bg-accent/5 p-4 text-sm leading-6 text-muted">
          <IconInfoCircle
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-accent"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
          <p>
            Status is calculated separately for each environment. Commented
            definitions are shown for context but do not count as active
            duplicates.
          </p>
        </div>
      </div>
    </aside>
  );
}

function environmentStatus(active: number, commented: number): string {
  if (active > 1) return `${active} active definitions`;
  if (active === 1) return 'Present';
  if (commented > 0) return 'Commented only';
  return 'Absent';
}

function sourceStatus(details: EnvironmentMatrixSourceDetail[]): string {
  const active = details.filter((detail) => !detail.isCommented).length;
  const commented = details.length - active;
  if (active > 1) return `${active} active definitions in this file`;
  if (active === 1) return 'Active';
  if (commented > 0) return 'Commented';
  return 'Absent';
}

function environmentExplanation(
  active: number,
  commented: number,
  environmentName: string,
): string {
  if (active > 1) {
    return `This key is actively defined more than once inside ${environmentName}. Review whether every listed source belongs to this environment.`;
  }
  if (active === 1 && commented > 0) {
    return `One active definition is used in ${environmentName}. ${commented} commented definition${commented === 1 ? '' : 's'} are retained only for context.`;
  }
  if (active === 1) {
    return `Exactly one active definition exists in ${environmentName}.`;
  }
  if (commented > 0) {
    return `The key appears only in commented lines inside ${environmentName}.`;
  }
  return `The key was not found in any readable source configured for ${environmentName}.`;
}

function sourceExplanation(
  details: EnvironmentMatrixSourceDetail[],
  sourcePath: string,
): string {
  const active = details.filter((detail) => !detail.isCommented).length;
  const commented = details.length - active;
  if (active > 1) {
    return `${sourcePath} contains ${active} active definitions of this key.`;
  }
  if (active === 1 && commented > 0) {
    return `${sourcePath} contains one active and ${commented} commented definition${commented === 1 ? '' : 's'}.`;
  }
  if (active === 1) return `${sourcePath} contains one active definition.`;
  if (commented > 0)
    return `${sourcePath} contains only commented definitions.`;
  return `${sourcePath} does not contain this key.`;
}
