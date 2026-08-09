import { Button, Card, Spinner, toast } from '@heroui/react';
import {
  IconFileExport,
  IconPlayerPlay,
  IconShieldCheck,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useEnvironmentsQuery } from '@/features/environment-tracker';
import { useActiveProject } from '@/features/projects';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { ManifestExportDialog } from '../components/ManifestExportDialog';
import { ValidationIssueFiltersPanel } from '../components/ValidationIssueFilters';
import { ValidationIssueTable } from '../components/ValidationIssueTable';
import { ValidationRuleFormModal } from '../components/ValidationRuleFormModal';
import { ValidationRulePanel } from '../components/ValidationRulePanel';
import { ValidationSummaryCards } from '../components/ValidationSummaryCards';
import {
  useDeleteValidationRuleMutation,
  useReorderValidationRulesMutation,
  useRunValidationMutation,
  useSaveValidationRuleMutation,
  useSetValidationIssueStatusMutation,
  useValidationIssuesQuery,
  useValidationRulesQuery,
  useValidationSummaryQuery,
} from '../hooks/use-validation-center';
import type {
  ValidationIssue,
  ValidationIssueFilters,
  ValidationRule,
  ValidationRuleFormValues,
} from '../models/validation';

const defaultIssueFilters: ValidationIssueFilters = {
  descending: true,
  page: 1,
  pageSize: 25,
  sort: 'updated_at',
  status: 'open',
};
const emptyEnvironments: never[] = [];
const emptyRules: never[] = [];
const emptyIssues: never[] = [];

export function ValidationCenterPage() {
  const { activeProjectId } = useActiveProject();
  const projectId = activeProjectId ?? '';
  const [filters, setFilters] = useState(defaultIssueFilters);
  const [editingRule, setEditingRule] = useState<ValidationRule | null>(null);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [isManifestOpen, setIsManifestOpen] = useState(false);
  const environments = useEnvironmentsQuery(projectId);
  const rules = useValidationRulesQuery(projectId);
  const summary = useValidationSummaryQuery(projectId);
  const issues = useValidationIssuesQuery(projectId, filters);
  const saveRule = useSaveValidationRuleMutation(projectId);
  const deleteRule = useDeleteValidationRuleMutation(projectId);
  const reorderRules = useReorderValidationRulesMutation(projectId);
  const runValidation = useRunValidationMutation(projectId);
  const setIssueStatus = useSetValidationIssueStatusMutation(projectId);
  const environmentItems = environments.data ?? emptyEnvironments;
  const ruleItems = rules.data ?? emptyRules;
  const issueItems = issues.data?.items ?? emptyIssues;

  async function submitRule(values: ValidationRuleFormValues) {
    try {
      await saveRule.mutateAsync({
        ...values,
        ...(editingRule ? { ruleId: editingRule.id } : {}),
      });
      toast.success(
        editingRule ? 'Validation rule updated' : 'Validation rule created',
      );
      setIsRuleModalOpen(false);
      setEditingRule(null);
    } catch (error) {
      toast.danger(safeError(error, 'The validation rule could not be saved.'));
    }
  }

  async function validateNow() {
    try {
      const result = await runValidation.mutateAsync();
      toast.success(
        `Validation complete: ${result.issuesDetected} issues detected, ${result.issuesResolved} resolved.`,
      );
    } catch (error) {
      toast.danger(
        safeError(error, 'Project validation could not be completed.'),
      );
    }
  }

  async function changeIssueStatus(issue: ValidationIssue) {
    try {
      await setIssueStatus.mutateAsync({
        issueId: issue.id,
        status: issue.status === 'ignored' ? 'open' : 'ignored',
      });
      toast.success(
        issue.status === 'ignored' ? 'Issue reopened' : 'Issue ignored',
      );
    } catch (error) {
      toast.danger(safeError(error, 'The issue status could not be changed.'));
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <header className="flex flex-col gap-3 pb-3 border-b border-divider sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <IconShieldCheck
              aria-hidden="true"
              className="text-accent"
              size={22}
              stroke={ICON_STROKE}
            />
            <h1 className="font-mono text-2xl font-semibold tracking-tight text-foreground">
              Validation Center
            </h1>
          </div>
          <p className="font-mono mt-1 max-w-3xl text-xs leading-relaxed text-muted">
            Compare environment key metadata across configured sources. Values
            are never stored, displayed, exported, or logged.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onPress={() => setIsManifestOpen(true)}
            size="sm"
            variant="secondary"
          >
            <IconFileExport
              aria-hidden="true"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
            Export .env.example
          </Button>
          <Button
            isDisabled={runValidation.isPending}
            onPress={() => void validateNow()}
            size="sm"
            variant="primary"
          >
            {runValidation.isPending ? (
              <Spinner aria-label="Running validation" size="sm" />
            ) : (
              <IconPlayerPlay
                aria-hidden="true"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
            )}
            Run validation
          </Button>
        </div>
      </header>

      <ValidationSummaryCards
        isLoading={summary.isLoading}
        summary={summary.data}
      />

      {(summary.isError ||
        rules.isError ||
        issues.isError ||
        environments.isError) && (
        <Card className="border border-danger/40 bg-danger/10">
          <Card.Content className="p-4 text-sm text-danger">
            Validation data could not be loaded. Local records were not changed.
            Retry the action or reopen this page.
          </Card.Content>
        </Card>
      )}

      <ValidationRulePanel
        environments={environmentItems}
        isLoading={rules.isLoading || environments.isLoading}
        isReordering={reorderRules.isPending}
        onCreate={() => {
          setEditingRule(null);
          setIsRuleModalOpen(true);
        }}
        onDelete={(rule) => {
          void deleteRule
            .mutateAsync(rule.id)
            .then(() => toast.success('Validation rule deleted'))
            .catch((error: unknown) =>
              toast.danger(
                safeError(error, 'The validation rule could not be deleted.'),
              ),
            );
        }}
        onEdit={(rule) => {
          setEditingRule(rule);
          setIsRuleModalOpen(true);
        }}
        onReorder={async (ruleIds) => {
          try {
            await reorderRules.mutateAsync(ruleIds);
          } catch (error) {
            toast.danger(
              safeError(error, 'The rule order could not be saved.'),
            );
          }
        }}
        rules={ruleItems}
      />

      <Card className="overflow-hidden border border-divider bg-surface rounded-[4px] shadow-none">
        <Card.Header className="border-b border-divider px-4 py-3">
          <Card.Title className="text-sm font-semibold">
            Validation issues
          </Card.Title>
          <Card.Description className="text-xs text-muted">
            Search and filter persisted metadata findings. Resolved issues
            remain reviewable.
          </Card.Description>
        </Card.Header>
        <Card.Content className="p-0">
          <ValidationIssueFiltersPanel
            environments={environmentItems}
            key={`${filters.search ?? ''}:${filters.environmentId ?? ''}:${filters.ruleType ?? ''}:${filters.issueType ?? ''}:${filters.severity ?? ''}:${filters.status ?? ''}`}
            onApply={setFilters}
            onReset={() => setFilters(defaultIssueFilters)}
            values={filters}
          />
          <ValidationIssueTable
            filters={filters}
            isLoading={issues.isLoading || issues.isFetching}
            isUpdating={setIssueStatus.isPending}
            issues={issueItems}
            onFilterChange={setFilters}
            onStatusChange={(issue) => void changeIssueStatus(issue)}
            totalItems={issues.data?.totalItems ?? 0}
            totalPages={issues.data?.totalPages ?? 0}
          />
        </Card.Content>
      </Card>

      <ValidationRuleFormModal
        environments={environmentItems}
        isOpen={isRuleModalOpen}
        isSaving={saveRule.isPending}
        onOpenChange={(isOpen) => {
          setIsRuleModalOpen(isOpen);
          if (!isOpen) setEditingRule(null);
        }}
        onSubmit={submitRule}
        rule={editingRule}
      />
      <ManifestExportDialog
        isOpen={isManifestOpen}
        onOpenChange={setIsManifestOpen}
        projectId={projectId}
      />
    </div>
  );
}

function safeError(error: unknown, fallback: string): string {
  return error instanceof TauriCommandError ? error.message : fallback;
}
