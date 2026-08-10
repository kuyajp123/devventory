import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Form, toast } from '@heroui/react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { OnboardingSummaryPanel } from '../components/OnboardingSummaryPanel';
import { ProjectDetailsFields } from '../components/ProjectDetailsFields';
import { ProjectFolderFields } from '../components/ProjectFolderFields';
import { useActiveProject } from '../hooks/use-active-project';
import {
  useCreateProjectMutation,
  useFolderPickerMutation,
  useScanProjectMutation,
  useValidateProjectRootMutation,
  useValidateProjectSubdirectoryMutation,
} from '../hooks/use-projects';
import {
  getConfigurationFingerprint,
  isBuiltInProjectExclusion,
  isSafeRelativeConfigurationPath,
  normalizeConfigurationPath,
  projectOnboardingSchema,
  type InitialScanSummary,
  type ProjectOnboardingValues,
  type WatchScope,
} from '../models/project';

export function ProjectOnboardingPage() {
  const navigate = useNavigate();
  const { selectProject } = useActiveProject();
  const folderPicker = useFolderPickerMutation();
  const validateRoot = useValidateProjectRootMutation();
  const validateSubdirectory = useValidateProjectSubdirectoryMutation();
  const scanProject = useScanProjectMutation();
  const createProject = useCreateProjectMutation();

  const [watchScope, setWatchScope] = useState<WatchScope>('entire-project');
  const [selectedFoldersDraft, setSelectedFoldersDraft] = useState<string[]>(
    [],
  );
  const [scanSummary, setScanSummary] = useState<InitialScanSummary | null>(
    null,
  );
  const [scannedFingerprint, setScannedFingerprint] = useState<string | null>(
    null,
  );
  const [rootValidated, setRootValidated] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setValue,
  } = useForm<ProjectOnboardingValues>({
    defaultValues: {
      description: '',
      exclusions: [],
      name: '',
      projectType: 'web',
      rootPath: '',
      watchScope: 'entire-project',
      watchedLocations: ['.'],
    },
    resolver: zodResolver(projectOnboardingSchema),
  });

  const rootPath = useWatch({ control, name: 'rootPath' });
  const exclusions = useWatch({ control, name: 'exclusions' });

  const effectiveWatchedLocations =
    watchScope === 'entire-project' ? ['.'] : selectedFoldersDraft;

  const currentFingerprint = rootPath
    ? getConfigurationFingerprint({
        exclusions,
        rootPath,
        watchedLocations: effectiveWatchedLocations,
      })
    : '';

  const isScanValid =
    Boolean(scanSummary) && scannedFingerprint === currentFingerprint;
  const isScanStale = Boolean(scanSummary) && !isScanValid;

  const isBusy =
    folderPicker.isPending ||
    validateRoot.isPending ||
    validateSubdirectory.isPending ||
    scanProject.isPending ||
    createProject.isPending;

  function handleWatchScopeChange(scope: WatchScope) {
    setWatchScope(scope);
    setValue('watchScope', scope, { shouldDirty: true, shouldValidate: true });
    const newEffective =
      scope === 'entire-project' ? ['.'] : selectedFoldersDraft;
    setValue('watchedLocations', newEffective, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  async function chooseRootFolder() {
    setOperationError(null);
    try {
      const selected = await folderPicker.mutateAsync(
        'Choose a project folder',
      );
      if (!selected) return;

      setRootValidated(false);
      setScanSummary(null);
      setScannedFingerprint(null);
      setSelectedFoldersDraft([]);
      setValue('rootPath', selected, {
        shouldDirty: true,
        shouldValidate: true,
      });

      const validated = await validateRoot.mutateAsync(selected);
      setValue('rootPath', validated.rootPath, {
        shouldDirty: true,
        shouldValidate: true,
      });

      // Reconcile child paths on root change: reset draft & exclusions
      const newEffective = watchScope === 'entire-project' ? ['.'] : [];
      setValue('watchedLocations', newEffective, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setValue('exclusions', [], { shouldDirty: true, shouldValidate: true });

      setRootValidated(true);
      toast.success(
        'Project folder validated. Reset watched locations and exclusions for the new folder.',
      );
    } catch (error) {
      setOperationError(errorMessage(error));
    }
  }

  async function chooseWatchedFolder() {
    if (!rootPath || !rootValidated) return;
    setOperationError(null);
    try {
      const selected = await folderPicker.mutateAsync(
        'Choose a watched folder inside project root',
      );
      if (!selected) return;

      const validated = await validateSubdirectory.mutateAsync({
        rootPath,
        targetPath: selected,
      });

      const normalized = normalizeConfigurationPath(validated.relativePath);
      if (normalized === '.') {
        toast.warning(
          'Project root cannot be added as a custom watched folder.',
        );
        return;
      }

      const existingNormalized = selectedFoldersDraft.map(
        normalizeConfigurationPath,
      );

      if (existingNormalized.includes(normalized)) {
        toast.warning(`"${normalized}" is already in watched locations.`);
        return;
      }

      const nextDraft = [...selectedFoldersDraft, normalized];
      setSelectedFoldersDraft(nextDraft);
      setValue('watchedLocations', nextDraft, {
        shouldDirty: true,
        shouldValidate: true,
      });
      toast.success(`Added watched folder: ${normalized}`);
    } catch (error) {
      setOperationError(errorMessage(error));
    }
  }

  async function chooseExclusionFolder() {
    if (!rootPath || !rootValidated) return;
    setOperationError(null);
    try {
      const selected = await folderPicker.mutateAsync(
        'Choose an exclusion folder inside project root',
      );
      if (!selected) return;

      const validated = await validateSubdirectory.mutateAsync({
        rootPath,
        targetPath: selected,
      });

      const normalized = normalizeConfigurationPath(validated.relativePath);
      if (normalized === '.') {
        toast.warning('Cannot exclude the entire project root.');
        return;
      }

      if (isBuiltInProjectExclusion(normalized)) {
        toast.warning(`"${normalized}" is already a built-in exclusion.`);
        return;
      }

      const existingNormalized = exclusions.map(normalizeConfigurationPath);
      if (existingNormalized.includes(normalized)) {
        toast.warning(`"${normalized}" is already in additional exclusions.`);
        return;
      }

      setValue('exclusions', [...exclusions, normalized], {
        shouldDirty: true,
        shouldValidate: true,
      });
      toast.success(`Added exclusion: ${normalized}`);
    } catch (error) {
      setOperationError(errorMessage(error));
    }
  }

  function addManualWatchedLocation(path: string) {
    const normalized = normalizeConfigurationPath(path);
    if (!isSafeRelativeConfigurationPath(normalized)) {
      toast.danger('Invalid relative path or parent traversal.');
      return;
    }
    if (normalized === '.') {
      toast.warning('Project root cannot be added as a custom watched folder.');
      return;
    }

    const existingNormalized = selectedFoldersDraft.map(
      normalizeConfigurationPath,
    );
    if (existingNormalized.includes(normalized)) {
      toast.warning(`"${normalized}" is already in watched locations.`);
      return;
    }

    const nextDraft = [...selectedFoldersDraft, normalized];
    setSelectedFoldersDraft(nextDraft);
    setValue('watchedLocations', nextDraft, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function addManualExclusion(path: string) {
    const normalized = normalizeConfigurationPath(path);
    if (!isSafeRelativeConfigurationPath(normalized)) {
      toast.danger('Invalid relative path or parent traversal.');
      return;
    }
    if (normalized === '.') {
      toast.warning('Cannot exclude the entire project root.');
      return;
    }
    if (isBuiltInProjectExclusion(normalized)) {
      toast.warning(`"${normalized}" is already a built-in exclusion.`);
      return;
    }

    const existingNormalized = exclusions.map(normalizeConfigurationPath);
    if (existingNormalized.includes(normalized)) {
      toast.warning(`"${normalized}" is already in additional exclusions.`);
      return;
    }

    setValue('exclusions', [...exclusions, normalized], {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function removeWatchedLocation(index: number) {
    const nextDraft = selectedFoldersDraft.filter((_, i) => i !== index);
    setSelectedFoldersDraft(nextDraft);
    setValue('watchedLocations', nextDraft, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function removeExclusion(index: number) {
    const updated = exclusions.filter((_, i) => i !== index);
    setValue('exclusions', updated, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  const runScan = handleSubmit(async (values) => {
    setOperationError(null);
    try {
      const summary = await scanProject.mutateAsync({
        exclusions: values.exclusions,
        rootPath: values.rootPath,
        watchedLocations: values.watchedLocations,
      });
      setScanSummary(summary);
      setScannedFingerprint(getConfigurationFingerprint(values));
      toast.success('Initial project scan completed');
    } catch (error) {
      setOperationError(errorMessage(error));
    }
  });

  const saveProject = handleSubmit(async (values) => {
    if (!isScanValid || !scanSummary) {
      const message = 'Run and review the initial scan before saving.';
      setOperationError(message);
      toast.warning(message);
      return;
    }

    setOperationError(null);
    try {
      const project = await createProject.mutateAsync({
        description: values.description || undefined,
        exclusions: values.exclusions,
        name: values.name,
        projectType: values.projectType,
        rootPath: values.rootPath,
        watchedLocations: values.watchedLocations,
      });
      await selectProject(project.id);
      toast.success('Project saved to this device');
      await navigate('/dashboard');
    } catch (error) {
      setOperationError(errorMessage(error));
    }
  });

  return (
    <section className="mx-auto w-full max-w-6xl space-y-8">
      <header className="space-y-2 border-b border-divider pb-6">
        <Link
          className="text-xs font-medium text-accent hover:underline font-mono"
          to="/dashboard"
        >
          &larr; Back to dashboard
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted font-mono">
            Project onboarding
          </p>
          <h1 className="font-mono mt-1 text-2xl font-semibold tracking-tight sm:text-3xl text-foreground">
            Add a local project
          </h1>
          <p className="font-mono mt-1 max-w-3xl leading-relaxed text-sm text-muted">
            Configure the project root, inspectable locations, and exclusions.
            Review an initial filesystem scan before saving locally.
          </p>
        </div>
      </header>

      <Form
        className="space-y-6"
        onSubmit={(event) => event.preventDefault()}
        validationBehavior="aria"
      >
        {operationError && (
          <Alert role="alert" status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Project operation failed</Alert.Title>
              <Alert.Description>{operationError}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        <div className="grid gap-8 lg:grid-cols-[1fr_340px] items-start">
          <main className="space-y-8">
            <ProjectDetailsFields
              control={control}
              errors={errors}
              isDisabled={isBusy}
              register={register}
            />
            <ProjectFolderFields
              errors={errors}
              exclusions={exclusions}
              isDisabled={isBusy}
              onAddExclusion={addManualExclusion}
              onAddWatchedLocation={addManualWatchedLocation}
              onChooseExclusionFolder={() => void chooseExclusionFolder()}
              onChooseFolder={() => void chooseRootFolder()}
              onChooseWatchedFolder={() => void chooseWatchedFolder()}
              onRemoveExclusion={removeExclusion}
              onRemoveWatchedLocation={removeWatchedLocation}
              onWatchScopeChange={handleWatchScopeChange}
              rootPath={rootPath}
              rootValidated={rootValidated}
              watchScope={watchScope}
              watchedLocations={effectiveWatchedLocations}
            />
          </main>

          <OnboardingSummaryPanel
            customExclusionCount={exclusions.length}
            isBusy={isBusy}
            isCreatePending={createProject.isPending}
            isScanPending={scanProject.isPending}
            isScanStale={isScanStale}
            isScanValid={isScanValid}
            onRunScan={() => void runScan()}
            onSaveProject={() => void saveProject()}
            rootPath={rootPath}
            rootValidated={rootValidated}
            scanSummary={scanSummary}
            watchScope={watchScope}
            watchedLocationCount={effectiveWatchedLocations.length}
          />
        </div>
      </Form>
    </section>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof TauriCommandError
    ? error.message
    : 'The project operation could not be completed.';
}
