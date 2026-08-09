import {
  Alert,
  Button,
  Card,
  Chip,
  Input,
  Label,
  TextField,
} from '@heroui/react';
import { IconSearch, IconSparkles } from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { AppPagination } from '@/shared/ui/AppPagination';
import type {
  VariantCandidate,
  VariantCandidatePage,
  VariantCandidateScope,
} from '../models/asset';
import { VariantCandidateTable } from './VariantCandidateTable';

const SCOPES: Array<{ label: string; value: VariantCandidateScope }> = [
  { label: 'Recommended', value: 'suggested' },
  { label: 'Current folder', value: 'same_folder' },
  { label: 'Asset root', value: 'asset_root' },
  { label: 'Imported', value: 'managed' },
  { label: 'Entire project', value: 'all' },
];

interface VariantCandidateBrowserProps {
  data?: VariantCandidatePage;
  isError: boolean;
  isFetching: boolean;
  isPending: boolean;
  onAdd: (candidate: VariantCandidate) => void;
  onPageChange: (page: number) => void;
  onScopeChange: (scope: VariantCandidateScope) => void;
  onSearchChange: (search: string) => void;
  page: number;
  scope: VariantCandidateScope;
  search: string;
}

export function VariantCandidateBrowser(props: VariantCandidateBrowserProps) {
  const { data, page, scope, search } = props;
  const showSuggestions = scope === 'suggested' && !search && page === 1;
  const suggested = showSuggestions ? (data?.items.slice(0, 3) ?? []) : [];
  const tableItems = showSuggestions
    ? (data?.items.slice(3) ?? [])
    : (data?.items ?? []);
  const start = data?.totalItems ? (page - 1) * (data.pageSize || 25) + 1 : 0;
  const end = data ? Math.min(page * data.pageSize, data.totalItems) : 0;

  return (
    <div className="min-w-0 space-y-4">
      {showSuggestions && (
        <Card className="border-accent/20 bg-accent/5">
          <Card.Header>
            <div className="flex items-start gap-2">
              <IconSparkles
                aria-hidden="true"
                className="mt-0.5 text-accent"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
              <div>
                <Card.Title>Suggested variants</Card.Title>
                <Card.Description>
                  Ranked by folder, asset root, filename, type, and metadata.
                </Card.Description>
              </div>
            </div>
          </Card.Header>
          <Card.Content className="space-y-2">
            {suggested.length ? (
              suggested.map((candidate) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-lg border border-default bg-surface p-3"
                  key={candidate.id}
                >
                  <span className="min-w-0 truncate font-mono text-sm">
                    {candidate.relativePath}
                  </span>
                  <Button
                    aria-label={`Add ${candidate.relativePath}`}
                    onPress={() => props.onAdd(candidate)}
                    size="sm"
                    variant="primary"
                  >
                    Add
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">
                No recommended files are available in this asset root.
              </p>
            )}
          </Card.Content>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <TextField className="min-w-0 flex-1" variant="secondary">
          <Label>Search variant filename or path</Label>
          <div className="relative">
            <IconSearch
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
            <Input
              aria-label="Search variant filename or path"
              className="pl-10"
              onChange={(event) => props.onSearchChange(event.target.value)}
              placeholder="Search filename or project-relative path..."
              type="search"
              value={search}
            />
          </div>
        </TextField>
        <div>
          <Label className="mb-1 block">Scope</Label>
          <div
            aria-label="Variant search scope"
            className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface-secondary p-1"
            role="group"
          >
            {SCOPES.map((option) => (
              <Button
                aria-pressed={scope === option.value}
                key={option.value}
                onPress={() => props.onScopeChange(option.value)}
                size="sm"
                variant={scope === option.value ? 'primary' : 'ghost'}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Showing {start}–{end} of {data?.totalItems ?? 0} matches
        </p>
        {data && (
          <Chip size="sm" variant="soft">
            <Chip.Label>Asset root: {data.assetRoot}</Chip.Label>
          </Chip>
        )}
      </div>

      {props.isError ? (
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Variant files unavailable</Alert.Title>
            <Alert.Description>
              The indexed candidate list could not be loaded.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : (
        <VariantCandidateTable
          candidates={tableItems}
          isFetching={props.isFetching}
          isPending={props.isPending}
          onAdd={props.onAdd}
        />
      )}

      <AppPagination
        ariaLabel="Variant candidate pages"
        onPageChange={props.onPageChange}
        page={page}
        totalPages={data?.totalPages ?? 0}
      />
    </div>
  );
}
