import { Button, Spinner } from '@heroui/react';
import {
  IconCheck,
  IconDeviceFloppy,
  IconEye,
  IconFolder,
  IconFolderOff,
  IconScan,
} from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { SemanticStatusChip } from '@/shared/ui';
import type { InitialScanSummary, WatchScope } from '../models/project';
import { DEFAULT_PROJECT_EXCLUSIONS } from '../models/project';
import { ScanSummaryCard } from './ScanSummaryCard';

interface OnboardingSummaryPanelProps {
  customExclusionCount: number;
  isBusy: boolean;
  isCreatePending: boolean;
  isScanPending: boolean;
  isScanStale: boolean;
  isScanValid: boolean;
  onRunScan: () => void;
  onSaveProject: () => void;
  rootPath: string;
  rootValidated: boolean;
  scanSummary: InitialScanSummary | null;
  watchScope: WatchScope;
  watchedLocationCount: number;
}

export function OnboardingSummaryPanel({
  customExclusionCount,
  isBusy,
  isCreatePending,
  isScanPending,
  isScanStale,
  isScanValid,
  onRunScan,
  onSaveProject,
  rootPath,
  rootValidated,
  scanSummary,
  watchScope,
  watchedLocationCount,
}: OnboardingSummaryPanelProps) {
  const rootBasename = rootPath
    ? rootPath.replace(/\\/g, '/').split('/').filter(Boolean).pop() || rootPath
    : 'No folder selected';

  return (
    <aside
      aria-label="Onboarding summary"
      className="space-y-6 rounded-lg border border-divider bg-workspace p-5 lg:sticky lg:top-6"
    >
      <header className="border-b border-divider pb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted font-mono">
          Onboarding summary
        </h2>
      </header>

      <dl className="space-y-4 text-xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="flex items-center gap-1.5 text-muted">
            <IconFolder
              aria-hidden="true"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
            <span>Project root</span>
          </dt>
          <dd className="flex items-center gap-2 font-mono font-medium text-foreground min-w-0">
            <span className="truncate max-w-[140px]" title={rootPath}>
              {rootBasename}
            </span>
            {rootValidated ? (
              <SemanticStatusChip
                dataStatus="validated"
                label="Validated"
                labelClassName="font-mono text-[9px]"
                tone="success"
              />
            ) : (
              <span className="text-[10px] text-muted">Unvalidated</span>
            )}
          </dd>
        </div>

        <div className="flex items-center justify-between gap-2">
          <dt className="flex items-center gap-1.5 text-muted">
            <IconEye
              aria-hidden="true"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
            <span>Watch scope</span>
          </dt>
          <dd className="font-mono font-medium text-foreground">
            {watchScope === 'entire-project'
              ? 'Entire project'
              : 'Selected folders'}
          </dd>
        </div>

        <div className="flex items-center justify-between gap-2">
          <dt className="flex items-center gap-1.5 text-muted">
            <IconFolder
              aria-hidden="true"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
            <span>Watched</span>
          </dt>
          <dd className="font-mono font-medium text-foreground">
            {watchScope === 'entire-project'
              ? 'All project folders'
              : `${watchedLocationCount} ${
                  watchedLocationCount === 1 ? 'folder' : 'folders'
                }`}
          </dd>
        </div>

        <div className="flex items-center justify-between gap-2">
          <dt className="flex items-center gap-1.5 text-muted">
            <IconFolderOff
              aria-hidden="true"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
            <span>Exclusions</span>
          </dt>
          <dd className="font-mono font-medium text-foreground">
            {customExclusionCount} custom + {DEFAULT_PROJECT_EXCLUSIONS.length}{' '}
            built-in
          </dd>
        </div>
      </dl>

      <section className="space-y-4 border-t border-divider pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted font-mono">
            Initial scan
          </h3>
          {isScanValid ? (
            <span className="flex items-center gap-1 text-[11px] font-medium text-success font-mono">
              <IconCheck size={12} stroke={ICON_STROKE} /> Ready
            </span>
          ) : isScanStale ? (
            <span className="text-[11px] font-medium text-warning font-mono">
              Scan stale
            </span>
          ) : (
            <span className="text-[11px] font-medium text-muted font-mono">
              Required
            </span>
          )}
        </div>

        {isScanValid && scanSummary ? (
          <ScanSummaryCard summary={scanSummary} compact hideHeader />
        ) : (
          <p className="text-xs leading-relaxed text-muted">
            {isScanStale
              ? 'Configuration changed after initial scan. Run scan again to verify discovery.'
              : 'Devventory must complete an initial filesystem scan before saving this project.'}
          </p>
        )}

        <div className="space-y-2 pt-2">
          {!isScanValid ? (
            <Button
              className="w-full"
              isDisabled={isBusy || !rootValidated}
              onPress={onRunScan}
              type="button"
              variant="secondary"
            >
              {isScanPending ? (
                <Spinner aria-label="Scanning project" size="sm" />
              ) : (
                <IconScan
                  aria-hidden="true"
                  size={ICON_SIZE.button}
                  stroke={ICON_STROKE}
                />
              )}
              {isScanPending ? 'Scanning…' : 'Run initial scan'}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                className="flex-1"
                isDisabled={isBusy}
                onPress={onRunScan}
                type="button"
                variant="secondary"
              >
                {isScanPending ? (
                  <Spinner aria-label="Rescanning project" size="sm" />
                ) : (
                  <IconScan
                    aria-hidden="true"
                    size={ICON_SIZE.button}
                    stroke={ICON_STROKE}
                  />
                )}
                {isScanPending ? 'Scanning…' : 'Rescan'}
              </Button>
              <Button
                className="flex-1"
                isDisabled={isBusy}
                onPress={onSaveProject}
                type="button"
                variant="primary"
              >
                {isCreatePending ? (
                  <Spinner aria-label="Saving project" size="sm" />
                ) : (
                  <IconDeviceFloppy
                    aria-hidden="true"
                    size={ICON_SIZE.button}
                    stroke={ICON_STROKE}
                  />
                )}
                {isCreatePending ? 'Saving…' : 'Save project'}
              </Button>
            </div>
          )}
        </div>
      </section>
    </aside>
  );
}
