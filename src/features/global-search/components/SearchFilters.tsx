import {
  Button,
  Form,
  Input,
  Label,
  ListBox,
  SearchField,
  Select,
  TextField,
} from '@heroui/react';
import { IconFilter, IconRefresh, IconSearch } from '@tabler/icons-react';
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

export function SearchFilters({
  environments,
  onApply,
  onProjectScopeChange,
  onQueryChange,
  projects,
  request,
}: SearchFiltersProps) {
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
  const [modifiedFrom, setModifiedFrom] = useState(
    toDateInput(request.modifiedFromMs),
  );
  const [modifiedTo, setModifiedTo] = useState(
    toDateInput(request.modifiedToMs),
  );

  function buildRequest(): SearchMetadataRequest {
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
    setModifiedFrom('');
    setModifiedTo('');
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
      className="rounded-md border border-divider bg-surface p-4 sm:p-5"
      onSubmit={submit}
      validationBehavior="aria"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
          <Label>Search metadata</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input
              autoFocus
              maxLength={256}
              placeholder="File, path, tag, note, project, or environment key"
            />
            <SearchField.ClearButton aria-label="Clear metadata search" />
          </SearchField.Group>
        </SearchField>
        <Button className="sm:min-w-28" type="submit" variant="primary">
          <IconSearch
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
          Search
        </Button>
      </div>

      <div className="mt-5 border-t border-divider pt-4">
        <div className="mb-3 flex items-center gap-2">
          <IconFilter
            aria-hidden="true"
            className="text-muted"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted">
            Advanced filters
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          <div className="grid grid-cols-2 gap-2">
            <TextField fullWidth variant="secondary">
              <Label>Modified from</Label>
              <Input
                onChange={(event) => setModifiedFrom(event.target.value)}
                type="date"
                value={modifiedFrom}
              />
            </TextField>
            <TextField fullWidth variant="secondary">
              <Label>Modified to</Label>
              <Input
                onChange={(event) => setModifiedTo(event.target.value)}
                type="date"
                value={modifiedTo}
              />
            </TextField>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit" variant="secondary">
            Apply filters
          </Button>
          <Button onPress={reset} type="button" variant="ghost">
            <IconRefresh
              aria-hidden="true"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
            Reset
          </Button>
        </div>
      </div>
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

function toDateInput(value: number | null): string {
  if (value === null) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
