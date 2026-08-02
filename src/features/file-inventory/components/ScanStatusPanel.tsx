import {
  Alert,
  Button,
  Card,
  Label,
  ListBox,
  Select,
  Spinner,
} from '@heroui/react';
import { IconRefresh, IconScan } from '@tabler/icons-react';
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
    <Card>
      <Card.Header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Card.Title className="flex items-center gap-2 text-lg">
            <IconScan
              aria-hidden="true"
              size={ICON_SIZE.navigation}
              stroke={ICON_STROKE}
            />
            Inventory scan
          </Card.Title>
          <Card.Description aria-live="polite" className="mt-2">
            {latest
              ? latestScanText(latest)
              : 'No persistent inventory scan has run yet.'}
          </Card.Description>
        </div>
        <Button
          isDisabled={isScanning}
          onPress={onRescanProject}
          variant="primary"
        >
          {isScanning ? (
            <Spinner aria-label="Scanning project" size="sm" />
          ) : (
            <IconRefresh
              aria-hidden="true"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
          )}
          {isScanning ? 'Scanning…' : 'Rescan project'}
        </Button>
      </Card.Header>

      <Card.Content className="space-y-5">
        {latest?.errorSummary && (
          <Alert status="danger">
            <Alert.Content>
              <Alert.Title>Latest scan needs attention</Alert.Title>
              <Alert.Description>{latest.errorSummary}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        {locations.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-divider pt-5 sm:flex-row sm:items-end">
            <Select
              className="min-w-0 flex-1"
              fullWidth
              onChange={(value) => setSelectedLocation(String(value ?? ''))}
              value={effectiveLocation}
              variant="secondary"
            >
              <Label>Watched location</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {locations.map((location) => (
                    <ListBox.Item
                      id={location.id}
                      key={location.id}
                      textValue={location.relativePath}
                    >
                      <Label>{location.relativePath}</Label>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <Button
              isDisabled={isScanning || !effectiveLocation}
              onPress={() => onRescanLocation(effectiveLocation)}
              variant="secondary"
            >
              Rescan location
            </Button>
          </div>
        )}
      </Card.Content>
    </Card>
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
