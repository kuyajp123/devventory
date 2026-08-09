import {
  Button,
  Card,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from '@heroui/react';
import { IconFilterOff } from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  PLATFORM_LABELS,
  type AgentAvailability,
  type AgentPlatform,
} from '../models/agent-usage';

export type AgentStatusFilter = AgentAvailability | 'all';
export type AgentPlatformFilter = AgentPlatform | 'all';
export type AgentSortOption = 'availability' | 'next_reset' | 'platform';

interface AgentUsageToolbarProps {
  onClear: () => void;
  onPlatformChange: (value: AgentPlatformFilter) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: AgentSortOption) => void;
  onStatusChange: (value: AgentStatusFilter) => void;
  platform: AgentPlatformFilter;
  search: string;
  sort: AgentSortOption;
  status: AgentStatusFilter;
}

export function AgentUsageToolbar({
  onClear,
  onPlatformChange,
  onSearchChange,
  onSortChange,
  onStatusChange,
  platform,
  search,
  sort,
  status,
}: AgentUsageToolbarProps) {
  const hasFilters =
    Boolean(search.trim()) || platform !== 'all' || status !== 'all';
  return (
    <Card className="border border-divider bg-surface">
      <Card.Content className="grid gap-2 p-3 md:grid-cols-[minmax(15rem,1fr)_repeat(3,minmax(9rem,0.55fr))_auto]">
        <TextField fullWidth variant="secondary">
          <Label className="sr-only">Search account identifier</Label>
          <Input
            aria-label="Search account identifier"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search account or platform..."
            value={search}
          />
        </TextField>
        <FilterSelect
          label="Platform"
          onChange={(value) => onPlatformChange(value as AgentPlatformFilter)}
          options={[
            ['all', 'All platforms'],
            ...Object.entries(PLATFORM_LABELS),
          ]}
          value={platform}
        />
        <FilterSelect
          label="Status"
          onChange={(value) => onStatusChange(value as AgentStatusFilter)}
          options={[
            ['all', 'All statuses'],
            ['available', 'Available'],
            ['limited', 'Limited'],
            ['exhausted', 'Exhausted'],
            ['resetSoon', 'Reset soon'],
            ['unknown', 'Unknown'],
          ]}
          value={status}
        />
        <FilterSelect
          label="Sort"
          onChange={(value) => onSortChange(value as AgentSortOption)}
          options={[
            ['availability', 'Availability'],
            ['next_reset', 'Next reset'],
            ['platform', 'Platform'],
          ]}
          value={sort}
        />
        <Button
          aria-label="Clear Agent Usage filters"
          isDisabled={!hasFilters}
          isIconOnly
          onPress={onClear}
          size="sm"
          variant="ghost"
        >
          <IconFilterOff
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
        </Button>
      </Card.Content>
    </Card>
  );
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: [string, string][];
  value: string;
}) {
  return (
    <Select
      aria-label={label}
      onChange={(next) => onChange(String(next))}
      value={value}
      variant="secondary"
    >
      <Label className="sr-only">{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map(([option, optionLabel]) => (
            <ListBox.Item id={option} key={option} textValue={optionLabel}>
              <Label>{optionLabel}</Label>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
