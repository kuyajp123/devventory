import { Button, Input, Tooltip } from '@heroui/react';
import {
  IconFolder,
  IconFolderOpen,
  IconPlus,
  IconX,
} from '@tabler/icons-react';
import { useState } from 'react';
import type { FieldErrors } from 'react-hook-form';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { SemanticStatusChip } from '@/shared/ui';
import {
  DEFAULT_PROJECT_EXCLUSIONS,
  normalizeConfigurationPath,
  type ProjectOnboardingValues,
  type WatchScope,
} from '../models/project';

interface ProjectFolderFieldsProps {
  errors: FieldErrors<ProjectOnboardingValues>;
  exclusions: string[];
  isDisabled: boolean;
  onAddExclusion: (path: string) => void;
  onAddWatchedLocation: (path: string) => void;
  onChooseExclusionFolder: () => void;
  onChooseFolder: () => void;
  onChooseWatchedFolder: () => void;
  onRemoveExclusion: (index: number) => void;
  onRemoveWatchedLocation: (index: number) => void;
  onWatchScopeChange: (scope: WatchScope) => void;
  rootPath: string;
  rootValidated: boolean;
  watchScope: WatchScope;
  watchedLocations: string[];
}

export function ProjectFolderFields({
  errors,
  exclusions,
  isDisabled,
  onAddExclusion,
  onAddWatchedLocation,
  onChooseExclusionFolder,
  onChooseFolder,
  onChooseWatchedFolder,
  onRemoveExclusion,
  onRemoveWatchedLocation,
  onWatchScopeChange,
  rootPath,
  rootValidated,
  watchScope,
  watchedLocations,
}: ProjectFolderFieldsProps) {
  const [showManualWatchedInput, setShowManualWatchedInput] = useState(false);
  const [manualWatchedPath, setManualWatchedPath] = useState('');
  const [showManualExclusionInput, setShowManualExclusionInput] =
    useState(false);
  const [manualExclusionPath, setManualExclusionPath] = useState('');

  function handleAddManualWatched() {
    if (!manualWatchedPath.trim()) return;
    onAddWatchedLocation(manualWatchedPath);
    setManualWatchedPath('');
    setShowManualWatchedInput(false);
  }

  function handleAddManualExclusion() {
    if (!manualExclusionPath.trim()) return;
    onAddExclusion(manualExclusionPath);
    setManualExclusionPath('');
    setShowManualExclusionInput(false);
  }

  return (
    <section className="space-y-6">
      {/* 1. PROJECT ROOT ROW */}
      <div className="rounded-lg border border-divider bg-workspace p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-divider bg-panel text-accent">
              <IconFolder size={ICON_SIZE.navigation} stroke={ICON_STROKE} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted font-mono">
                  Project root
                </span>
                {rootValidated && (
                  <SemanticStatusChip
                    dataStatus="validated"
                    label="Validated"
                    labelClassName="font-mono text-[9px]"
                    tone="success"
                  />
                )}
              </div>
              {rootPath ? (
                <Tooltip delay={0}>
                  <p className="truncate font-mono text-sm font-medium text-foreground">
                    {rootPath}
                  </p>
                  <Tooltip.Content placement="bottom start">
                    <p className="font-mono text-xs">{rootPath}</p>
                  </Tooltip.Content>
                </Tooltip>
              ) : (
                <p className="font-mono text-xs italic text-muted">
                  No folder selected yet
                </p>
              )}
            </div>
          </div>

          <Button
            aria-label={rootPath ? 'Change root folder' : 'Choose root folder'}
            isDisabled={isDisabled}
            onPress={onChooseFolder}
            type="button"
            variant="secondary"
          >
            <IconFolderOpen
              aria-hidden="true"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
            {rootPath ? 'Change folder' : 'Choose folder'}
          </Button>
        </div>

        {errors.rootPath && (
          <p className="text-xs text-danger">{errors.rootPath.message}</p>
        )}
      </div>

      {/* 2. WATCH SCOPE SELECTOR */}
      <div className="space-y-3 rounded-lg border border-divider bg-workspace p-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">Watch scope</h3>
          <p className="mt-0.5 text-xs text-muted">
            Choose whether Devventory should watch the entire project root or
            only specific folders inside it.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            className={`flex flex-col items-start justify-between rounded-lg border p-3.5 text-left transition-colors cursor-pointer ${
              watchScope === 'entire-project'
                ? 'border-accent bg-panel ring-1 ring-accent'
                : 'border-divider bg-workspace hover:bg-panel'
            }`}
            disabled={isDisabled}
            onClick={() => onWatchScopeChange('entire-project')}
            type="button"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 font-medium text-xs text-foreground">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${watchScope === 'entire-project' ? 'bg-accent' : 'border border-muted'}`}
                />
                <span>Entire project</span>
              </div>
              <span className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-accent uppercase tracking-wider">
                Recommended
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Watch everything under the project root, except excluded
              directories.
            </p>
          </button>

          <button
            className={`flex flex-col items-start justify-between rounded-lg border p-3.5 text-left transition-colors cursor-pointer ${
              watchScope === 'selected-folders'
                ? 'border-accent bg-panel ring-1 ring-accent'
                : 'border-divider bg-workspace hover:bg-panel'
            }`}
            disabled={isDisabled}
            onClick={() => onWatchScopeChange('selected-folders')}
            type="button"
          >
            <div className="flex items-center gap-2 font-medium text-xs text-foreground">
              <span
                className={`h-2.5 w-2.5 rounded-full ${watchScope === 'selected-folders' ? 'bg-accent' : 'border border-muted'}`}
              />
              <span>Selected folders</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Only watch specific folders inside this project.
            </p>
          </button>
        </div>
      </div>

      {/* 3. WATCHED FOLDERS (Selected folders mode only) */}
      {watchScope === 'selected-folders' && (
        <div className="space-y-3 rounded-lg border border-divider bg-workspace p-4">
          <div>
            <h3 className="text-sm font-medium text-foreground">
              Watched folders
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              Only the folders listed below will be inspected and monitored by
              Devventory.
            </p>
          </div>

          {watchedLocations.length > 0 ? (
            <ul
              aria-label="Watched folders"
              className="space-y-2 font-mono text-xs"
            >
              {watchedLocations.map((location, index) => (
                <li
                  className="flex items-center justify-between gap-3 rounded-md border border-divider bg-panel px-3 py-2"
                  key={`${location}-${index}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <IconFolder
                      aria-hidden="true"
                      className="shrink-0 text-muted"
                      size={14}
                      stroke={ICON_STROKE}
                    />
                    <span className="truncate font-medium text-foreground">
                      {location}
                    </span>
                  </div>

                  <Button
                    aria-label={`Remove watched location ${location}`}
                    className="h-6 w-6 min-w-0 p-0 text-muted hover:text-danger"
                    isDisabled={isDisabled}
                    onPress={() => onRemoveWatchedLocation(index)}
                    size="sm"
                    type="button"
                    variant="tertiary"
                  >
                    <IconX size={14} stroke={ICON_STROKE} />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs italic text-warning font-normal">
              Add at least one watched folder.
            </p>
          )}

          {showManualWatchedInput ? (
            <div className="flex items-center gap-2 pt-1">
              <Input
                className="flex-1 font-mono text-xs"
                placeholder="e.g. src/ or apps/web/"
                value={manualWatchedPath}
                onChange={(e) => setManualWatchedPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddManualWatched();
                  } else if (e.key === 'Escape') {
                    setShowManualWatchedInput(false);
                  }
                }}
              />
              <Button
                isDisabled={isDisabled || !manualWatchedPath.trim()}
                onPress={handleAddManualWatched}
                size="sm"
                type="button"
                variant="primary"
              >
                Add
              </Button>
              <Button
                onPress={() => setShowManualWatchedInput(false)}
                size="sm"
                type="button"
                variant="tertiary"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 pt-1">
              <Button
                isDisabled={isDisabled}
                onPress={() => setShowManualWatchedInput(true)}
                size="sm"
                type="button"
                variant="tertiary"
              >
                <IconPlus size={14} stroke={ICON_STROKE} />
                Enter path
              </Button>
              <Button
                aria-label="Choose watched folder"
                isDisabled={isDisabled || !rootValidated}
                onPress={onChooseWatchedFolder}
                size="sm"
                type="button"
                variant="tertiary"
              >
                <IconFolderOpen size={14} stroke={ICON_STROKE} />
                Choose folder
              </Button>
            </div>
          )}

          {errors.watchedLocations && (
            <p className="text-xs text-danger font-normal">
              {errors.watchedLocations.message}
            </p>
          )}
        </div>
      )}

      {/* 3. ADDITIONAL EXCLUSIONS */}
      <div className="space-y-3 rounded-lg border border-divider bg-workspace p-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            Additional exclusions
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            Optional project-relative directory prefixes Devventory should
            ignore.
          </p>
        </div>

        {exclusions.length > 0 ? (
          <ul
            aria-label="Additional exclusions"
            className="space-y-2 font-mono text-xs"
          >
            {exclusions.map((exclusion, index) => (
              <li
                className="flex items-center justify-between gap-3 rounded-md border border-divider bg-panel px-3 py-2"
                key={`${exclusion}-${index}`}
              >
                <span className="truncate font-medium text-foreground">
                  {normalizeConfigurationPath(exclusion)}
                </span>
                <Button
                  aria-label={`Remove exclusion ${exclusion}`}
                  className="h-6 w-6 min-w-0 p-0 text-muted hover:text-danger"
                  isDisabled={isDisabled}
                  onPress={() => onRemoveExclusion(index)}
                  size="sm"
                  type="button"
                  variant="tertiary"
                >
                  <IconX size={14} stroke={ICON_STROKE} />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs italic text-muted">
            No custom exclusions added.
          </p>
        )}

        {showManualExclusionInput ? (
          <div className="flex items-center gap-2 pt-1">
            <Input
              className="flex-1 font-mono text-xs"
              placeholder="e.g. logs/ or tmp/generated/"
              value={manualExclusionPath}
              onChange={(e) => setManualExclusionPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddManualExclusion();
                } else if (e.key === 'Escape') {
                  setShowManualExclusionInput(false);
                }
              }}
            />
            <Button
              isDisabled={isDisabled || !manualExclusionPath.trim()}
              onPress={handleAddManualExclusion}
              size="sm"
              type="button"
              variant="primary"
            >
              Add
            </Button>
            <Button
              onPress={() => setShowManualExclusionInput(false)}
              size="sm"
              type="button"
              variant="tertiary"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex gap-2 pt-1">
            <Button
              isDisabled={isDisabled}
              onPress={() => setShowManualExclusionInput(true)}
              size="sm"
              type="button"
              variant="tertiary"
            >
              <IconPlus size={14} stroke={ICON_STROKE} />
              Add exclusion
            </Button>
            <Button
              aria-label="Choose exclusion folder"
              isDisabled={isDisabled || !rootValidated}
              onPress={onChooseExclusionFolder}
              size="sm"
              type="button"
              variant="tertiary"
            >
              <IconFolderOpen size={14} stroke={ICON_STROKE} />
              Choose folder
            </Button>
          </div>
        )}

        {errors.exclusions && (
          <p className="text-xs text-danger font-normal">
            {errors.exclusions.message}
          </p>
        )}
      </div>

      {/* 4. BUILT-IN EXCLUSIONS */}
      <section
        aria-labelledby="built-in-exclusions-title"
        className="rounded-lg border border-divider bg-workspace p-4 space-y-3"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3
            className="text-sm font-medium text-foreground"
            id="built-in-exclusions-title"
          >
            Built-in exclusions
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            Managed by Devventory
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          These technical directories are always excluded from scans and the
          Project Tree. They cannot be edited or removed.
        </p>
        <ul className="flex flex-wrap gap-1.5" aria-label="Built-in exclusions">
          {DEFAULT_PROJECT_EXCLUSIONS.map((exclusion) => (
            <li
              className="rounded border border-divider bg-panel px-2 py-1 font-mono text-[11px] text-secondary"
              key={exclusion}
            >
              {exclusion}
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
