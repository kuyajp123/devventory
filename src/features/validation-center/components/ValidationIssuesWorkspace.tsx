import { Card } from '@heroui/react';
import type { Environment } from '@/features/environment-tracker';
import type { ValidationIssue } from '@/shared/models/validation';
import type { ValidationWorkspaceController } from '../hooks/use-validation-workspace';
import { defaultValidationIssueFilters } from '../hooks/use-validation-workspace';
import { ValidationIssueFiltersPanel } from './ValidationIssueFilters';
import { ValidationIssueTable } from './ValidationIssueTable';

export function ValidationIssuesWorkspace({
  controller,
  environments,
  onNavigateToCell,
}: {
  controller: ValidationWorkspaceController;
  environments: Environment[];
  onNavigateToCell?: (issue: ValidationIssue) => void;
}) {
  const issues = controller.issues.data?.items ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col p-4 sm:px-6 lg:px-8">
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[4px] border border-divider bg-surface shadow-none">
        <Card.Content className="flex min-h-0 flex-1 flex-col p-0">
          {controller.issues.isError ? (
            <div className="shrink-0 border-b border-danger/40 bg-danger/10 p-3 text-xs text-danger">
              Validation issues could not be loaded. Adjust the filters or retry
              the validation run.
            </div>
          ) : null}
          <div className="shrink-0">
            <ValidationIssueFiltersPanel
              environments={environments}
              key={`${controller.filters.search ?? ''}:${controller.filters.environmentId ?? ''}:${controller.filters.ruleType ?? ''}:${controller.filters.issueType ?? ''}:${controller.filters.severity ?? ''}:${controller.filters.status ?? ''}`}
              onApply={controller.setFilters}
              onReset={() =>
                controller.setFilters(defaultValidationIssueFilters)
              }
              values={controller.filters}
            />
          </div>
          <div className="min-h-0 flex-1">
            <ValidationIssueTable
              filters={controller.filters}
              isLoading={
                controller.issues.isLoading || controller.issues.isFetching
              }
              isUpdating={controller.setIssueStatus.isPending}
              issues={issues}
              onFilterChange={controller.setFilters}
              onNavigateToCell={onNavigateToCell}
              onStatusChange={(issue) =>
                void controller.changeIssueStatus(issue)
              }
              totalItems={controller.issues.data?.totalItems ?? 0}
              totalPages={controller.issues.data?.totalPages ?? 0}
            />
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
