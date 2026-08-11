import type { Environment } from '@/features/environment-tracker';
import type { ValidationWorkspaceController } from '../hooks/use-validation-workspace';
import { ManifestExportDialog } from './ManifestExportDialog';
import { ValidationRuleFormModal } from './ValidationRuleFormModal';

export function ValidationWorkspaceDialogs({
  controller,
  environments,
  projectId,
}: {
  controller: ValidationWorkspaceController;
  environments: Environment[];
  projectId: string;
}) {
  return (
    <>
      <ValidationRuleFormModal
        environments={environments}
        isOpen={controller.isRuleModalOpen}
        isSaving={controller.saveRule.isPending}
        onOpenChange={(isOpen) => {
          if (isOpen) controller.setIsRuleModalOpen(true);
          else controller.closeRuleModal();
        }}
        onSubmit={controller.submitRule}
        rule={controller.editingRule}
      />
      <ManifestExportDialog
        isOpen={controller.isManifestOpen}
        onOpenChange={controller.setIsManifestOpen}
        projectId={projectId}
      />
    </>
  );
}
