import { Button, Chip } from '@heroui/react';
import {
  IconAlertTriangle,
  IconDatabase,
  IconFileCode,
  IconInfoCircle,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import type { ValidationIssue } from '@/shared/models/validation';
import { SemanticStatusChip } from '@/shared/ui';
import type {
  Environment,
  EnvironmentSourceOrigin,
  EnvironmentMatrixCellValidation,
  EnvironmentMatrixSourceDetail,
} from '../models/environment';
import { EnvironmentValidationDetails } from './EnvironmentValidationDetails';

export interface EnvironmentKeySelection {
  environment: Environment;
  keyName: string;
  selectedSource?: {
    id: string;
    label: string;
    origin: EnvironmentSourceOrigin;
  };
  selectedSourcePath?: string;
  sourceDetails: EnvironmentMatrixSourceDetail[];
  validation: EnvironmentMatrixCellValidation;
}

export function EnvironmentKeyDetails({
  isUpdatingIssue = false,
  onClose,
  onDefinitionClick,
  onIssueStatusChange = () => {},
  selection,
}: {
  isUpdatingIssue?: boolean;
  onClose: () => void;
  onDefinitionClick?: (relativePath: string) => void;
  onIssueStatusChange?: (issue: ValidationIssue) => void;
  selection: EnvironmentKeySelection | null;
}) {
  if (!selection) {
    return null;
  }

  return (
    <EnvironmentKeyDetailsContent
      isUpdatingIssue={isUpdatingIssue}
      key={`${selection.environment.id}:${selection.keyName}:${selection.selectedSourcePath ?? 'environment'}`}
      onClose={onClose}
      onDefinitionClick={onDefinitionClick}
      onIssueStatusChange={onIssueStatusChange}
      selection={selection}
    />
  );
}

function EnvironmentKeyDetailsContent({
  isUpdatingIssue,
  onClose,
  onDefinitionClick,
  onIssueStatusChange,
  selection,
}: {
  isUpdatingIssue: boolean;
  onClose: () => void;
  onDefinitionClick?: (relativePath: string) => void;
  onIssueStatusChange: (issue: ValidationIssue) => void;
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
  const selectedSourceId =
    selection.selectedSource?.id ??
    selection.selectedSourcePath ??
    selectedDefinitionPath;
  const selectedSourceDetails = useMemo(
    () =>
      selectedSourceId
        ? selection.sourceDetails.filter(
            (detail) => detail.sourceId === selectedSourceId,
          )
        : selection.sourceDetails,
    [selectedSourceId, selection.sourceDetails],
  );
  const selectedSourceOrigin =
    selection.selectedSource?.origin ?? selectedSourceDetails[0]?.origin;
  const effectiveSelectedSourcePath = selectedSourceId
    ? (selection.selectedSource?.label ??
      sourceDetailLabel(selectedSourceDetails[0]))
    : null;
  const status = effectiveSelectedSourcePath
    ? sourceStatus(selectedSourceDetails, selectedSourceOrigin)
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

  function handleDefinitionClick(sourceId: string) {
    setSelectedDefinitionPath(sourceId);
    onDefinitionClick?.(sourceId);
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

      <div className="space-y-4 p-4">
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
                  sourceDetailLabel(selectedSourceDetails[0]),
                )
              : environmentExplanation(
                  activeDetails.length,
                  commentedDetails.length,
                  selection.environment.name,
                )}
          </p>
        </section>

        <div className="border-t border-divider pt-4">
          <EnvironmentValidationDetails
            isUpdating={isUpdatingIssue}
            onStatusChange={onIssueStatusChange}
            validation={selection.validation}
          />
        </div>

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
                const isSelected = selectedSourceId === detail.sourceId;
                const sourceLabel = sourceDetailLabel(detail);

                return (
                  <li
                    key={`${detail.sourceId}:${detail.lineNumber ?? 'metadata'}:${index}`}
                  >
                    <button
                      aria-pressed={isSelected}
                      className={`w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 ${
                        isSelected
                          ? 'relative z-10 bg-surface-secondary shadow-sm ring-2 ring-inset ring-foreground/25'
                          : ''
                      } ${
                        onDefinitionClick
                          ? 'cursor-pointer hover:border-foreground/25 hover:bg-surface-secondary'
                          : 'cursor-default'
                      }`}
                      data-definition-path={sourceLabel}
                      data-selected={isSelected ? 'true' : undefined}
                      onClick={() => handleDefinitionClick(detail.sourceId)}
                      type="button"
                    >
                      <div className="flex items-start gap-3">
                        {detail.origin === 'custom' ? (
                          <IconDatabase
                            aria-hidden="true"
                            className="mt-0.5 shrink-0 text-muted"
                            size={ICON_SIZE.button}
                            stroke={ICON_STROKE}
                          />
                        ) : (
                          <IconFileCode
                            aria-hidden="true"
                            className="mt-0.5 shrink-0 text-muted"
                            size={ICON_SIZE.button}
                            stroke={ICON_STROKE}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-sm">
                            {sourceLabel}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {detail.origin === 'custom'
                              ? 'Custom metadata source'
                              : detail.lineNumber
                                ? `Line ${detail.lineNumber}`
                                : 'Line unavailable'}
                          </p>
                        </div>
                        <SemanticStatusChip
                          dataStatus={
                            detail.isCommented
                              ? 'commented'
                              : detail.origin === 'custom'
                                ? 'present'
                                : 'active'
                          }
                          label={
                            detail.isCommented
                              ? 'Commented'
                              : detail.origin === 'custom'
                                ? 'Present'
                                : 'Active'
                          }
                          tone={detail.isCommented ? 'neutral' : 'success'}
                        />
                        {detail.origin === 'custom' ? (
                          <SemanticStatusChip
                            dataStatus="custom"
                            label="Custom"
                            tone="neutral"
                          />
                        ) : null}
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

function sourceStatus(
  details: EnvironmentMatrixSourceDetail[],
  origin?: EnvironmentSourceOrigin,
): string {
  const active = details.filter((detail) => !detail.isCommented).length;
  const commented = details.length - active;
  if (origin === 'custom') {
    if (active > 1) return 'Duplicate';
    return active === 1 ? 'Present' : 'Absent';
  }
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

function sourceDetailLabel(detail?: EnvironmentMatrixSourceDetail): string {
  return detail?.relativePath ?? detail?.sourceName ?? 'source';
}
