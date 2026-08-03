import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Form, Spinner, toast } from '@heroui/react';
import { IconDeviceFloppy, IconScan } from '@tabler/icons-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { ProjectDetailsFields } from '../components/ProjectDetailsFields';
import { ProjectFolderFields } from '../components/ProjectFolderFields';
import { ScanSummaryCard } from '../components/ScanSummaryCard';
import {
  useCreateProjectMutation,
  useFolderPickerMutation,
  useScanProjectMutation,
  useValidateProjectRootMutation,
} from '../hooks/use-projects';
import {
  DEFAULT_PROJECT_EXCLUSIONS,
  projectOnboardingSchema,
  splitConfigurationLines,
  type InitialScanSummary,
  type ProjectOnboardingValues,
} from '../models/project';
import { useActiveProject } from '../providers/ActiveProjectProvider';

export function ProjectOnboardingPage() {
  const navigate = useNavigate();
  const { selectProject } = useActiveProject();
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
    control,
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
  const rootPath = useWatch({ control, name: 'rootPath' });

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
      toast.success('Project folder validated');
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
      toast.success('Initial project scan completed');
    } catch (error) {
      setOperationError(errorMessage(error));
    }
  });

  const saveProject = handleSubmit(async (values) => {
    if (!scanSummary) {
      const message = 'Run and review the initial scan before saving.';
      setOperationError(message);
      toast.warning(message);
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
      await selectProject(project.id);
      toast.success('Project saved to this device');
      await navigate('/dashboard');
    } catch (error) {
      setOperationError(errorMessage(error));
    }
  });

  return (
    <section className="mx-auto w-full max-w-5xl space-y-8">
      <header className="space-y-3">
        <Link
          className="text-sm font-medium text-accent hover:underline"
          to="/dashboard"
        >
          Back to dashboard
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

      <Form
        className="space-y-6"
        onSubmit={(event) => event.preventDefault()}
        validationBehavior="aria"
      >
        <ProjectDetailsFields
          control={control}
          errors={errors}
          isDisabled={isBusy}
          register={register}
        />
        <ProjectFolderFields
          control={control}
          errors={errors}
          isDisabled={isBusy}
          onChooseFolder={chooseFolder}
          onConfigurationChange={() => setScanSummary(null)}
          register={register}
          rootPath={rootPath}
          rootValidated={rootValidated}
        />

        {operationError && (
          <Alert role="alert" status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Project operation failed</Alert.Title>
              <Alert.Description>{operationError}</Alert.Description>
            </Alert.Content>
          </Alert>
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
              <Spinner aria-label="Scanning project" size="sm" />
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
              <Spinner aria-label="Saving project" size="sm" />
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
      </Form>
    </section>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof TauriCommandError
    ? error.message
    : 'The project operation could not be completed.';
}
