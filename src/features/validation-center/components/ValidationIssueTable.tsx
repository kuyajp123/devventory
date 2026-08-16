import { Button, EmptyState, Spinner, Table } from '@heroui/react';
import {
  IconCircleCheck,
  IconExternalLink,
  IconEyeOff,
  IconListCheck,
} from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { AppPagination } from '@/shared/ui/AppPagination';
import { SemanticStatusChip } from '@/shared/ui';
import {
  validationIssueTypeLabel,
  type ValidationIssue,
  type ValidationIssueFilters,
} from '../models/validation';

interface ValidationIssueTableProps {
  filters: ValidationIssueFilters;
  isLoading: boolean;
  isUpdating: boolean;
  issues: ValidationIssue[];
  onFilterChange: (filters: ValidationIssueFilters) => void;
  onNavigateToCell?: (issue: ValidationIssue) => void;
  onStatusChange: (issue: ValidationIssue) => void;
  totalItems: number;
  totalPages: number;
}

export function ValidationIssueTable({
  filters,
  isLoading,
  isUpdating,
  issues,
  onFilterChange,
  onNavigateToCell,
  onStatusChange,
  totalItems,
  totalPages,
}: ValidationIssueTableProps) {
  if (isLoading && issues.length === 0) {
    return (
      <div className="flex min-h-52 items-center justify-center">
        <Spinner aria-label="Loading validation issues" />
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <EmptyState className="m-4 rounded-md border border-dashed border-divider bg-workspace p-8 text-center">
        <IconListCheck
          aria-hidden="true"
          className="mx-auto text-muted"
          size={ICON_SIZE.emptyState}
          stroke={ICON_STROKE}
        />
        <h3 className="mt-3 font-semibold">No validation issues found</h3>
        <p className="mt-1 text-sm text-muted">
          Run validation or adjust the filters. A healthy result stores key
          metadata only.
        </p>
      </EmptyState>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-divider px-4 py-2 text-xs text-muted">
        <span>{totalItems.toLocaleString()} matching issues</span>
        {isLoading && (
          <Spinner aria-label="Refreshing validation issues" size="sm" />
        )}
      </div>
      <Table className="min-h-0 flex-1" variant="secondary">
        <Table.ScrollContainer className="h-full min-h-0 overflow-auto">
          <Table.Content
            aria-label="Validation issues"
            className="min-w-[1050px]"
            onSortChange={(descriptor) => {
              const sort = descriptor.column as ValidationIssueFilters['sort'];
              if (
                [
                  'updated_at',
                  'severity',
                  'key',
                  'environment',
                  'status',
                ].includes(sort)
              ) {
                onFilterChange({
                  ...filters,
                  descending: descriptor.direction === 'descending',
                  page: 1,
                  sort,
                });
              }
            }}
            sortDescriptor={{
              column: filters.sort,
              direction: filters.descending ? 'descending' : 'ascending',
            }}
          >
            <Table.Header className="sticky top-0 z-20 bg-surface">
              <SortableColumn id="key" isRowHeader label="Key / issue" />
              <SortableColumn id="environment" label="Environment" />
              <SortableColumn id="severity" label="Severity" />
              <Table.Column id="source">Source</Table.Column>
              <SortableColumn id="status" label="Status" />
              <SortableColumn id="updated_at" label="Last seen" />
              <Table.Column id="actions">Action</Table.Column>
            </Table.Header>
            <Table.Body items={issues}>
              {(issue) => (
                <Table.Row id={issue.id}>
                  <Table.Cell className="max-w-sm">
                    <p className="truncate font-mono text-xs font-semibold">
                      {issue.keyName}
                    </p>
                    <p
                      className="truncate text-xs text-muted"
                      title={issue.message}
                    >
                      {validationIssueTypeLabel(issue.issueType)} ·{' '}
                      {issue.message}
                    </p>
                  </Table.Cell>
                  <Table.Cell>{issue.environmentName ?? 'Project'}</Table.Cell>
                  <Table.Cell>
                    <SeverityChip severity={issue.severity} />
                  </Table.Cell>
                  <Table.Cell className="max-w-xs">
                    <p
                      className="truncate font-mono text-xs text-muted"
                      title={issue.sourcePath ?? undefined}
                    >
                      {issue.sourcePath ?? 'No source file'}
                      {issue.lineNumber ? `:${issue.lineNumber}` : ''}
                    </p>
                  </Table.Cell>
                  <Table.Cell>
                    <StatusChip status={issue.status} />
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-xs text-muted">
                    {formatTimestamp(issue.lastSeenAt)}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-1">
                      {onNavigateToCell && (
                        <Button
                          aria-label={`Highlight ${issue.keyName} in environment matrix`}
                          isDisabled={!issue.environmentId}
                          onPress={() => onNavigateToCell(issue)}
                          size="sm"
                          variant="ghost"
                        >
                          <IconExternalLink
                            aria-hidden="true"
                            size={ICON_SIZE.small}
                            stroke={ICON_STROKE}
                          />
                          View
                        </Button>
                      )}
                      {issue.status !== 'resolved' && (
                        <Button
                          aria-label={`${issue.status === 'ignored' ? 'Reopen' : 'Ignore'} ${issue.keyName} issue`}
                          isDisabled={isUpdating}
                          onPress={() => onStatusChange(issue)}
                          size="sm"
                          variant="ghost"
                        >
                          {issue.status === 'ignored' ? (
                            <IconCircleCheck
                              aria-hidden="true"
                              size={ICON_SIZE.small}
                              stroke={ICON_STROKE}
                            />
                          ) : (
                            <IconEyeOff
                              aria-hidden="true"
                              size={ICON_SIZE.small}
                              stroke={ICON_STROKE}
                            />
                          )}
                          {issue.status === 'ignored' ? 'Reopen' : 'Ignore'}
                        </Button>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      <div className="shrink-0 border-t border-divider p-3">
        <AppPagination
          ariaLabel="Validation issue pages"
          onPageChange={(page) => onFilterChange({ ...filters, page })}
          page={filters.page}
          totalPages={totalPages}
        />
      </div>
    </div>
  );
}

function SortableColumn({
  id,
  isRowHeader,
  label,
}: {
  id: ValidationIssueFilters['sort'];
  isRowHeader?: boolean;
  label: string;
}) {
  return (
    <Table.Column allowsSorting id={id} isRowHeader={isRowHeader}>
      {({ sortDirection }) => (
        <Table.SortableColumnHeader sortDirection={sortDirection}>
          {label}
        </Table.SortableColumnHeader>
      )}
    </Table.Column>
  );
}

function SeverityChip({ severity }: { severity: ValidationIssue['severity'] }) {
  return (
    <SemanticStatusChip
      dataStatus={severity}
      label={severity}
      labelClassName="capitalize"
      tone={
        severity === 'error'
          ? 'danger'
          : severity === 'warning'
            ? 'warning'
            : 'neutral'
      }
    />
  );
}

function StatusChip({ status }: { status: ValidationIssue['status'] }) {
  return (
    <SemanticStatusChip
      dataStatus={status}
      label={status}
      labelClassName="capitalize"
      tone={
        status === 'open'
          ? 'accent'
          : status === 'ignored'
            ? 'warning'
            : 'success'
      }
    />
  );
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
