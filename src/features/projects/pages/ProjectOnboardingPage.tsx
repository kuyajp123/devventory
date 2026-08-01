import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@heroui/react';
import {
  IconDeviceFloppy,
  IconFolderOpen,
  IconLoader2,
  IconScan,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { ScanSummaryCard } from '../components/ScanSummaryCard';
import {
  DEFAULT_PROJECT_EXCLUSIONS,
  projectOnboardingSchema,
  projectTypeOptions,
  splitConfigurationLines,
  type InitialScanSummary,
  type ProjectOnboardingValues,
} from '../models/project';
import {
  useCreateProjectMutation,
  useFolderPickerMutation,
  useScanProjectMutation,
  useValidateProjectRootMutation,
} from '../hooks/use-projects';

const fieldClassName =
  'mt-2 w-full rounded-xl border border-divider bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60';

export function ProjectOnboardingPage() {
  const navigate = useNavigate();
  const folderPicker = useFolderPickerMutation();
  const validateRoot = useValidateProjectRootMutation();
  const scanProject = useScanProjectMutation();
  const createProject = useCreateProjectMutation();
  const [scanSummary, setScanSummary] = useState<InitialScanSummary | null>(
    null,
  );
  const [rootValidated, setRootValidated] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const {
    formState: { errors },
    handleSubmit,
    register,
    setValue,
  } = useForm<ProjectOnboardingValues>({
    defaultValues: {
      description: '',
      exclusionsText: DEFAULT_PROJECT_EXCLUSIONS.join('\n'),
      name: '',
      projectType: 'web',
      rootPath: '',
      watchedLocationsText: '.',
    },
    resolver: zodResolver(projectOnboardingSchema),
  });

  const isBusy =
    folderPicker.isPending ||
    validateRoot.isPending ||
    scanProject.isPending ||
    createProject.isPending;

  async function chooseFolder() {
    setOperationError(null);
    try {
      const selected = await folderPicker.mutateAsync();
      if (!selected) return;

      setRootValidated(false);
      setScanSummary(null);
      setValue('rootPath', selected, {
        shouldDirty: true,
        shouldValidate: true,
      });
      const validated = await validateRoot.mutateAsync(selected);
      setValue('rootPath', validated.rootPath, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setRootValidated(true);
    } catch (error) {
      setOperationError(errorMessage(error));
    }
  }

  function configurationFrom(values: ProjectOnboardingValues) {
    return {
      exclusions: splitConfigurationLines(values.exclusionsText),
      rootPath: values.rootPath,
      watchedLocations: splitConfigurationLines(values.watchedLocationsText),
    };
  }

  const runScan = handleSubmit(async (values) => {
    setOperationError(null);
    setScanSummary(null);
    try {
      const summary = await scanProject.mutateAsync(configurationFrom(values));
      setScanSummary(summary);
    } catch (error) {
      setOperationError(errorMessage(error));
    }
  });

  const saveProject = handleSubmit(async (values) => {
    if (!scanSummary) {
      setOperationError('Run and review the initial scan before saving.');
      return;
    }

    setOperationError(null);
    try {
      const project = await createProject.mutateAsync({
        ...configurationFrom(values),
        description: values.description || undefined,
        name: values.name,
        projectType: values.projectType,
      });
      await navigate(`/projects/${project.id}`);
    } catch (error) {
      setOperationError(errorMessage(error));
    }
  });

  function invalidateScan() {
    setScanSummary(null);
  }

  return (
    <section className="mx-auto w-full max-w-5xl space-y-8">
      <header className="space-y-3">
        <Link
          className="text-sm font-medium text-accent hover:underline"
          to="/projects"
        >
          Back to projects
        </Link>
        <div>
          <p className="text-sm font-medium text-muted">Project onboarding</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            Add a local project
          </h1>
          <p className="mt-2 max-w-3xl leading-7 text-muted">
            Choose the folder Devventory may inspect, configure the allowed
            locations, then review a summary-only scan before saving locally.
          </p>
        </div>
      </header>

      <form
        className="space-y-6"
        noValidate
        onSubmit={(event) => event.preventDefault()}
      >
        <fieldset
          className="grid gap-5 rounded-2xl border border-divider bg-surface p-5 sm:grid-cols-2 sm:p-6"
          disabled={isBusy}
        >
          <legend className="px-2 text-lg font-semibold">
            Project details
          </legend>

          <label className="block text-sm font-medium">
            Project name
            <input
              aria-invalid={Boolean(errors.name)}
              className={fieldClassName}
              {...register('name')}
            />
            <FieldError message={errors.name?.message} />
          </label>

          <label className="block text-sm font-medium">
            Project type
            <select className={fieldClassName} {...register('projectType')}>
              {projectTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <FieldError message={errors.projectType?.message} />
          </label>

          <label className="block text-sm font-medium sm:col-span-2">
            Description (optional)
            <textarea
              className={`${fieldClassName} min-h-24 resize-y`}
              {...register('description')}
            />
            <FieldError message={errors.description?.message} />
          </label>
        </fieldset>

        <fieldset
          className="space-y-5 rounded-2xl border border-divider bg-surface p-5 sm:p-6"
          disabled={isBusy}
        >
          <legend className="px-2 text-lg font-semibold">Local folders</legend>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-sm font-medium">
              Selected project root
              <input
                className={`${fieldClassName} font-mono text-xs`}
                placeholder="No folder selected"
                readOnly
                {...register('rootPath')}
              />
              <FieldError message={errors.rootPath?.message} />
              {rootValidated && (
                <span className="mt-2 block text-xs font-medium text-success">
                  Folder validated
                </span>
              )}
            </label>
            <Button onPress={chooseFolder} type="button" variant="secondary">
              <IconFolderOpen
                aria-hidden="true"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
              Choose folder
            </Button>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <label className="block text-sm font-medium">
              Watched locations
              <textarea
                aria-describedby="watched-location-help"
                className={`${fieldClassName} min-h-36 resize-y font-mono text-xs`}
                {...register('watchedLocationsText', {
                  onChange: invalidateScan,
                })}
              />
              <span
                className="mt-2 block text-xs leading-5 text-muted"
                id="watched-location-help"
              >
                One relative folder per line. Use <code>.</code> for the project
                root.
              </span>
              <FieldError message={errors.watchedLocationsText?.message} />
            </label>

            <label className="block text-sm font-medium">
              Exclusions
              <textarea
                aria-describedby="exclusion-help"
                className={`${fieldClassName} min-h-36 resize-y font-mono text-xs`}
                {...register('exclusionsText', { onChange: invalidateScan })}
              />
              <span
                className="mt-2 block text-xs leading-5 text-muted"
                id="exclusion-help"
              >
                One relative directory prefix per line. Glob patterns are not
                used.
              </span>
              <FieldError message={errors.exclusionsText?.message} />
            </label>
          </div>
        </fieldset>

        {operationError && (
          <p
            aria-live="assertive"
            className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
            role="alert"
          >
            {operationError}
          </p>
        )}

        {scanSummary && <ScanSummaryCard summary={scanSummary} />}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            isDisabled={isBusy}
            onPress={() => void runScan()}
            type="button"
            variant="secondary"
          >
            {scanProject.isPending ? (
              <IconLoader2
                aria-hidden="true"
                className="animate-spin"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
            ) : (
              <IconScan
                aria-hidden="true"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
            )}
            {scanProject.isPending ? 'Scanning…' : 'Run initial scan'}
          </Button>
          <Button
            isDisabled={isBusy || !scanSummary}
            onPress={() => void saveProject()}
            type="button"
            variant="primary"
          >
            {createProject.isPending ? (
              <IconLoader2
                aria-hidden="true"
                className="animate-spin"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
            ) : (
              <IconDeviceFloppy
                aria-hidden="true"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
            )}
            {createProject.isPending ? 'Saving…' : 'Save project'}
          </Button>
        </div>
      </form>
    </section>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <span className="mt-2 block text-xs font-medium text-danger">
      {message}
    </span>
  ) : null;
}

function errorMessage(error: unknown): string {
  return error instanceof TauriCommandError
    ? error.message
    : 'The project operation could not be completed.';
}
