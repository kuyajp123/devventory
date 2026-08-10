import {
  Button,
  Chip,
  DateField,
  DateRangePicker,
  Form,
  Input,
  Label,
  ListBox,
  RangeCalendar,
  SearchField,
  Select,
  TextField,
} from '@heroui/react';
import { parseDate, type DateValue } from '@internationalized/date';
import {
  IconChevronDown,
  IconChevronUp,
  IconFilter,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react';
import { type FormEvent, useState } from 'react';
import type { Environment } from '@/features/environment-tracker';
import { fileCategoryOptions } from '@/features/file-inventory';
import type { Project } from '@/features/projects';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import type { SearchMetadataRequest } from '../models/search';
import {
  ALL_FILTER_VALUE,
  composeSearchRequest,
} from '../models/search-filter-request';

interface SearchFiltersProps {
  environments: Environment[];
  onApply: (request: SearchMetadataRequest, recordHistory: boolean) => void;
  onProjectScopeChange: (projectId: string | null) => void;
  onQueryChange: (query: string) => void;
  projects: Project[];
  request: SearchMetadataRequest;
}

interface DateRangeValue {
  end: DateValue;
  start: DateValue;
}

function msToDateString(ms: number | null): string | null {
  if (ms === null) return null;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initDateRange(
  fromMs: number | null,
  toMs: number | null,
): DateRangeValue | null {
  const fromStr = msToDateString(fromMs);
  const toStr = msToDateString(toMs);
  if (fromStr && toStr) {
    try {
      return { end: parseDate(toStr), start: parseDate(fromStr) };
    } catch {
      return null;
    }
  }
  return null;
}

export function SearchFilters({
  environments,
  onApply,
  onProjectScopeChange,
  onQueryChange,
  projects,
  request,
}: SearchFiltersProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [query, setQuery] = useState(request.query);
  const [projectId, setProjectId] = useState(
    request.projectId ?? ALL_FILTER_VALUE,
  );
  const [category, setCategory] = useState<string>(
    request.categories[0] ?? ALL_FILTER_VALUE,
  );
  const [extension, setExtension] = useState(request.extensions.join(', '));
  const [tags, setTags] = useState(request.tags.join(', '));
  const [environmentId, setEnvironmentId] = useState(
    request.environmentIds[0] ?? ALL_FILTER_VALUE,
  );
  const [status, setStatus] = useState<string>(
    request.statuses[0] ?? ALL_FILTER_VALUE,
  );
  const [origin, setOrigin] = useState<string>(
    request.origins[0] ?? ALL_FILTER_VALUE,
  );
  const [dateRange, setDateRange] = useState<DateRangeValue | null>(() =>
    initDateRange(request.modifiedFromMs, request.modifiedToMs),
  );

  const activeFilterCount =
    (projectId !== ALL_FILTER_VALUE && projectId !== null ? 1 : 0) +
    (category !== ALL_FILTER_VALUE ? 1 : 0) +
    (status !== ALL_FILTER_VALUE ? 1 : 0) +
    (origin !== ALL_FILTER_VALUE ? 1 : 0) +
    (extension.trim() ? 1 : 0) +
    (tags.trim() ? 1 : 0) +
    (environmentId !== ALL_FILTER_VALUE ? 1 : 0) +
    (dateRange !== null ? 1 : 0);

  function buildRequest(): SearchMetadataRequest {
    const modifiedFrom = dateRange?.start ? dateRange.start.toString() : '';
    const modifiedTo = dateRange?.end ? dateRange.end.toString() : '';

    return composeSearchRequest(request, {
      category,
      environmentId,
      extension,
      modifiedFrom,
      modifiedTo,
      origin,
      projectId,
      query,
      status,
      tags,
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply(buildRequest(), true);
  }

  function reset() {
    setQuery('');
    setProjectId(ALL_FILTER_VALUE);
    setCategory(ALL_FILTER_VALUE);
    setExtension('');
    setTags('');
    setEnvironmentId(ALL_FILTER_VALUE);
    setStatus(ALL_FILTER_VALUE);
    setOrigin(ALL_FILTER_VALUE);
    setDateRange(null);
    onApply(
      {
        ...request,
        categories: [],
        environmentIds: [],
        extensions: [],
        modifiedFromMs: null,
        modifiedToMs: null,
        origins: [],
        page: 1,
        projectId: null,
        query: '',
        sortBy: 'relevance',
        sortDirection: 'ascending',
        statuses: [],
        tags: [],
      },
      false,
    );
  }

  return (
    <Form
      className="shrink-0 rounded-[4px] border border-divider bg-surface p-3"
      onSubmit={submit}
      validationBehavior="aria"
    >
      {/* Primary Search Input Row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchField
          className="flex-1"
          fullWidth
          onChange={(value) => {
            setQuery(value);
            onQueryChange(value);
          }}
          value={query}
          variant="secondary"
        >
          <Label className="sr-only">Search metadata</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input
              autoFocus
              maxLength={256}
              placeholder="Search file, path, tag, note, project, or environment key..."
            />
            <SearchField.ClearButton aria-label="Clear metadata search" />
          </SearchField.Group>
        </SearchField>
        <Button className="sm:min-w-24" type="submit" variant="primary">
          <IconSearch
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
          Search
        </Button>
      </div>

      {/* Advanced Filters Toggle Button */}
      <div className="mt-2.5 flex items-center justify-between">
        <Button
          aria-expanded={isFiltersOpen}
          aria-label="Toggle advanced filters"
          className="h-7 gap-1.5 px-2 font-mono text-xs text-muted hover:text-foreground"
          onPress={() => setIsFiltersOpen((open) => !open)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <IconFilter
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
          <span>Advanced filters</span>
          {isFiltersOpen ? (
            <IconChevronUp aria-hidden="true" size={14} />
          ) : (
            <IconChevronDown aria-hidden="true" size={14} />
          )}
        </Button>

        {activeFilterCount > 0 && (
          <Chip size="sm" variant="soft">
            <Chip.Label className="font-mono text-[10px]">
              Filters • {activeFilterCount}
            </Chip.Label>
          </Chip>
        )}
      </div>

      {/* Collapsible Advanced Filters Panel */}
      {isFiltersOpen && (
        <div className="mt-3 border-t border-divider pt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FilterSelect
              label="Project scope"
              onChange={(value) => {
                setProjectId(value);
                setEnvironmentId(ALL_FILTER_VALUE);
                onProjectScopeChange(value === ALL_FILTER_VALUE ? null : value);
              }}
              options={[
                { label: 'All projects', value: ALL_FILTER_VALUE },
                ...projects.map((project) => ({
                  label: project.name,
                  value: project.id,
                })),
              ]}
              value={projectId}
            />
            <FilterSelect
              label="File category"
              onChange={setCategory}
              options={[
                { label: 'All categories', value: ALL_FILTER_VALUE },
                ...fileCategoryOptions,
              ]}
              value={category}
            />
            <FilterSelect
              label="File status"
              onChange={setStatus}
              options={[
                { label: 'All statuses', value: ALL_FILTER_VALUE },
                { label: 'Active', value: 'active' },
                { label: 'Missing', value: 'missing' },
              ]}
              value={status}
            />
            <FilterSelect
              label="Origin"
              onChange={setOrigin}
              options={[
                { label: 'Managed and discovered', value: ALL_FILTER_VALUE },
                { label: 'Managed', value: 'managed' },
                { label: 'Discovered', value: 'discovered' },
              ]}
              value={origin}
            />
            <TextField
              fullWidth
              onChange={setExtension}
              value={extension}
              variant="secondary"
            >
              <Label>Extensions</Label>
              <Input maxLength={256} placeholder="tsx, png, md" />
            </TextField>
            <TextField
              fullWidth
              onChange={setTags}
              value={tags}
              variant="secondary"
            >
              <Label>Asset tags</Label>
              <Input maxLength={512} placeholder="brand, approved" />
            </TextField>
            <FilterSelect
              isDisabled={projectId === ALL_FILTER_VALUE}
              label="Environment"
              onChange={setEnvironmentId}
              options={[
                {
                  label:
                    projectId === ALL_FILTER_VALUE
                      ? 'Select one project first'
                      : 'All environments',
                  value: ALL_FILTER_VALUE,
                },
                ...environments.map((environment) => ({
                  label: environment.name,
                  value: environment.id,
                })),
              ]}
              value={environmentId}
            />
            <DateRangePicker
              aria-label="Modified date range"
              onChange={(value) => setDateRange(value as DateRangeValue | null)}
              value={dateRange}
            >
              <Label>Modified date range</Label>
              <DateField.Group variant="secondary">
                <DateField.InputContainer>
                  <DateField.Input slot="start">
                    {(segment) => <DateField.Segment segment={segment} />}
                  </DateField.Input>
                  <DateRangePicker.RangeSeparator />
                  <DateField.Input slot="end">
                    {(segment) => <DateField.Segment segment={segment} />}
                  </DateField.Input>
                </DateField.InputContainer>
                <DateField.Suffix>
                  <DateRangePicker.Trigger>
                    <DateRangePicker.TriggerIndicator />
                  </DateRangePicker.Trigger>
                </DateField.Suffix>
              </DateField.Group>
              <DateRangePicker.Popover placement="bottom start">
                <RangeCalendar aria-label="Choose modified date range">
                  <RangeCalendar.Header>
                    <RangeCalendar.NavButton slot="previous" />
                    <RangeCalendar.Heading />
                    <RangeCalendar.NavButton slot="next" />
                  </RangeCalendar.Header>
                  <RangeCalendar.Grid>
                    <RangeCalendar.GridHeader>
                      {(day) => (
                        <RangeCalendar.HeaderCell>
                          {day}
                        </RangeCalendar.HeaderCell>
                      )}
                    </RangeCalendar.GridHeader>
                    <RangeCalendar.GridBody>
                      {(date) => <RangeCalendar.Cell date={date} />}
                    </RangeCalendar.GridBody>
                  </RangeCalendar.Grid>
                </RangeCalendar>
              </DateRangePicker.Popover>
            </DateRangePicker>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" type="submit" variant="primary">
              Apply filters
            </Button>
            <Button onPress={reset} size="sm" type="button" variant="secondary">
              <IconRefresh
                aria-hidden="true"
                size={ICON_SIZE.small}
                stroke={ICON_STROKE}
              />
              Reset
            </Button>
          </div>
        </div>
      )}
    </Form>
  );
}

function FilterSelect({
  isDisabled = false,
  label,
  onChange,
  options,
  value,
}: {
  isDisabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <Select
      fullWidth
      isDisabled={isDisabled}
      onChange={(next) => onChange(String(next ?? ALL_FILTER_VALUE))}
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
