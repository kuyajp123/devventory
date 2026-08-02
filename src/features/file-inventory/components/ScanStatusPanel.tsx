import { Button } from '@heroui/react';
import { IconLoader2, IconRefresh, IconScan } from '@tabler/icons-react';
import { useState } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import type {
  InventoryWatchedLocation,
  ScanRun,
} from '../models/file-inventory';

interface ScanStatusPanelProps {
  isScanning: boolean;
  locations: InventoryWatchedLocation[];
  scans: ScanRun[];
  onRescanLocation: (locationId: string) => void;
  onRescanProject: () => void;
}

export function ScanStatusPanel({
  isScanning,
  locations,
  scans,
  onRescanLocation,
  onRescanProject,
}: ScanStatusPanelProps) {
  const [selectedLocation, setSelectedLocation] = useState(
    locations[0]?.id ?? '',
  );
  const latest = scans[0];
  const effectiveLocation = selectedLocation || locations[0]?.id || '';

  return (
    <section className="rounded-2xl border border-divider bg-surface p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <IconScan
              aria-hidden="true"
              size={ICON_SIZE.navigation}
              stroke={ICON_STROKE}
            />
            Inventory scan
          </h2>
          <p className="mt-2 text-sm text-muted" aria-live="polite">
            {latest
              ? latestScanText(latest)
              : 'No persistent inventory scan has run yet.'}
          </p>
          {latest?.errorSummary && (
            <p className="mt-2 text-sm text-danger" role="alert">
              {latest.errorSummary}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            isDisabled={isScanning}
            onPress={onRescanProject}
            variant="primary"
          >
            {isScanning ? (
              <IconLoader2
                aria-hidden="true"
                className="animate-spin"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
            ) : (
              <IconRefresh
                aria-hidden="true"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
            )}
            {isScanning ? 'Scanning…' : 'Rescan project'}
          </Button>
        </div>
      </div>

      {locations.length > 0 && (
        <div className="mt-5 flex flex-col gap-3 border-t border-divider pt-5 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-sm font-medium">
            Watched location
            <select
              className="mt-2 w-full rounded-xl border border-divider bg-background px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              onChange={(event) => setSelectedLocation(event.target.value)}
              value={effectiveLocation}
            >
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.relativePath}
                </option>
              ))}
            </select>
          </label>
          <Button
            isDisabled={isScanning || !effectiveLocation}
            onPress={() => onRescanLocation(effectiveLocation)}
            variant="secondary"
          >
            Rescan location
          </Button>
        </div>
      )}
    </section>
  );
}

function latestScanText(scan: ScanRun): string {
  const label =
    scan.status === 'completed' ? 'Completed' : capitalize(scan.status);
  return `${label}: ${scan.filesDiscovered.toLocaleString()} files found, ${scan.filesAdded.toLocaleString()} added, ${scan.filesUpdated.toLocaleString()} updated, and ${scan.filesMissing.toLocaleString()} missing.`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
