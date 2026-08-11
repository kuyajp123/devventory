import {
  Button,
  Chip,
  Form,
  Label,
  ListBox,
  SearchField,
  Select,
} from '@heroui/react';
import {
  IconChevronDown,
  IconChevronUp,
  IconFilter,
  IconRefresh,
} from '@tabler/icons-react';
import { type FormEvent, useState } from 'react';
import type { Environment } from '@/features/environment-tracker';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  validationIssueTypeLabel,
  type ValidationIssueFilters,
  type ValidationIssueStatus,
  type ValidationIssueType,
  type ValidationRuleType,
  type ValidationSeverity,
} from '../models/validation';

const ALL = 'all';
const issueTypes: ValidationIssueType[] = [
  'required_missing',
  'required_commented',
  'forbidden_present',
  'unexpected_present',
  'duplicate',
  'case_mismatch',
  'invalid_name',
  'source_unreadable',
  'parse_issue',
];

export function ValidationIssueFiltersPanel({
  environments,
  onApply,
  onReset,
  values,
}: {
  environments: Environment[];
  onApply: (filters: ValidationIssueFilters) => void;
  onReset: () => void;
  values: ValidationIssueFilters;
}) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [search, setSearch] = useState(values.search ?? '');
  const [environmentId, setEnvironmentId] = useState(
    values.environmentId ?? ALL,
  );
  const [issueType, setIssueType] = useState<ValidationIssueType | typeof ALL>(
    values.issueType ?? ALL,
  );
  const [ruleType, setRuleType] = useState<ValidationRuleType | typeof ALL>(
    values.ruleType ?? ALL,
  );
  const [severity, setSeverity] = useState<ValidationSeverity | typeof ALL>(
    values.severity ?? ALL,
  );
  const [status, setStatus] = useState<ValidationIssueStatus | typeof ALL>(
    values.status ?? 'open',
  );
  const activeFilterCount =
    (environmentId !== ALL ? 1 : 0) +
    (issueType !== ALL ? 1 : 0) +
    (ruleType !== ALL ? 1 : 0) +
    (severity !== ALL ? 1 : 0) +
    (status !== 'open' ? 1 : 0);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply({
      ...values,
      environmentId: environmentId === ALL ? undefined : environmentId,
      issueType: issueType === ALL ? undefined : issueType,
      page: 1,
      ruleType: ruleType === ALL ? undefined : ruleType,
      search: search.trim() || undefined,
      severity: severity === ALL ? undefined : severity,
      status: status === ALL ? undefined : status,
    });
  }

  return (
    <Form
      className="border-b border-divider bg-workspace p-3"
      onSubmit={submit}
      validationBehavior="aria"
    >
      <SearchField
        fullWidth
        onChange={setSearch}
        value={search}
        variant="secondary"
      >
        <Label>Search issues</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input
            maxLength={128}
            placeholder="Key, path, or issue"
          />
          <SearchField.ClearButton aria-label="Clear issue search" />
        </SearchField.Group>
      </SearchField>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <Button
          aria-controls="validation-issue-advanced-filters"
          aria-expanded={isAdvancedOpen}
          aria-label="Toggle advanced issue filters"
          className="h-7 gap-1.5 px-2 font-mono text-xs text-muted hover:text-foreground"
          onPress={() => setIsAdvancedOpen((open) => !open)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <IconFilter
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
          Advanced filters
          {isAdvancedOpen ? (
            <IconChevronUp aria-hidden="true" size={ICON_SIZE.small} />
          ) : (
            <IconChevronDown aria-hidden="true" size={ICON_SIZE.small} />
          )}
        </Button>

        {activeFilterCount > 0 ? (
          <Chip size="sm" variant="soft">
            <Chip.Label className="font-mono text-[10px]">
              Filters · {activeFilterCount}
            </Chip.Label>
          </Chip>
        ) : null}
      </div>

      {isAdvancedOpen ? (
        <div
          className="mt-3 space-y-3 border-t border-divider pt-3"
          id="validation-issue-advanced-filters"
        >
          <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-5">
            <FilterSelect
              label="Status"
              onChange={(value) =>
                setStatus(value as ValidationIssueStatus | typeof ALL)
              }
              options={[
                { label: 'All statuses', value: ALL },
                { label: 'Open', value: 'open' },
                { label: 'Ignored', value: 'ignored' },
                { label: 'Resolved', value: 'resolved' },
              ]}
              value={status}
            />
            <FilterSelect
              label="Severity"
              onChange={(value) =>
                setSeverity(value as ValidationSeverity | typeof ALL)
              }
              options={[
                { label: 'All severities', value: ALL },
                { label: 'Error', value: 'error' },
                { label: 'Warning', value: 'warning' },
                { label: 'Info', value: 'info' },
              ]}
              value={severity}
            />
            <FilterSelect
              label="Environment"
              onChange={setEnvironmentId}
              options={[
                { label: 'All environments', value: ALL },
                ...environments.map((environment) => ({
                  label: environment.name,
                  value: environment.id,
                })),
              ]}
              value={environmentId}
            />
            <FilterSelect
              label="Rule type"
              onChange={(value) =>
                setRuleType(value as ValidationRuleType | typeof ALL)
              }
              options={[
                { label: 'All rule types', value: ALL },
                { label: 'Required', value: 'required' },
                { label: 'Optional', value: 'optional' },
                { label: 'Forbidden', value: 'forbidden' },
              ]}
              value={ruleType}
            />
            <FilterSelect
              label="Issue type"
              onChange={(value) =>
                setIssueType(value as ValidationIssueType | typeof ALL)
              }
              options={[
                { label: 'All issue types', value: ALL },
                ...issueTypes.map((value) => ({
                  label: validationIssueTypeLabel(value),
                  value,
                })),
              ]}
              value={issueType}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="submit" variant="primary">
              <IconFilter
                aria-hidden="true"
                size={ICON_SIZE.small}
                stroke={ICON_STROKE}
              />
              Apply filters
            </Button>
            <Button
              onPress={onReset}
              size="sm"
              type="button"
              variant="secondary"
            >
              <IconRefresh
                aria-hidden="true"
                size={ICON_SIZE.small}
                stroke={ICON_STROKE}
              />
              Reset
            </Button>
          </div>
        </div>
      ) : null}
    </Form>
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
  options: { label: string; value: string }[];
  value: string;
}) {
  return (
    <Select
      fullWidth
      onChange={(next) => onChange(next == null ? ALL : String(next))}
      value={value}
      variant="secondary"
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item
              id={option.value}
              key={option.value}
              textValue={option.label}
            >
              <Label>{option.label}</Label>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
