import { Button, Card, Spinner } from '@heroui/react';
import { IconFileExport, IconPlayerPlay } from '@tabler/icons-react';
import type { Environment } from '@/features/environment-tracker';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import type { ValidationWorkspaceController } from '../hooks/use-validation-workspace';
import { ValidationRulePanel } from './ValidationRulePanel';
import { ValidationSummaryCards } from './ValidationSummaryCards';

export function ValidationRulesHealthWorkspace({
  controller,
  environments,
}: {
  controller: ValidationWorkspaceController;
  environments: Environment[];
}) {
  const rules = controller.rules.data ?? [];
  const hasError = controller.rules.isError || controller.summary.isError;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4 sm:px-6 lg:px-8">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-xs text-muted">
          Define required, optional, and forbidden key placement without storing
          environment values.
        </p>
        <div className="flex items-center gap-2">
          <Button
            onPress={() => controller.setIsManifestOpen(true)}
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
            isDisabled={controller.runValidation.isPending}
            onPress={() => void controller.validateNow()}
            size="sm"
            variant="primary"
          >
            {controller.runValidation.isPending ? (
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
      </div>

      <div className="shrink-0">
        <ValidationSummaryCards
          isLoading={controller.summary.isLoading}
          summary={controller.summary.data}
        />
      </div>

      {hasError ? (
        <Card className="shrink-0 border border-danger/40 bg-danger/10">
          <Card.Content className="p-3 text-xs text-danger">
            Validation rules or health could not be loaded. Local records were
            not changed.
          </Card.Content>
        </Card>
      ) : null}

      <div className="min-h-0 flex-1">
        <ValidationRulePanel
          environments={environments}
          isLoading={controller.rules.isLoading}
          isReordering={controller.reorderRules.isPending}
          onCreate={controller.openCreateRule}
          onDelete={(rule) => void controller.removeRule(rule)}
          onEdit={controller.openEditRule}
          onReorder={controller.reorderRuleIds}
          onToggle={(rule) => void controller.toggleRule(rule)}
          rules={rules}
        />
      </div>
    </div>
  );
}
