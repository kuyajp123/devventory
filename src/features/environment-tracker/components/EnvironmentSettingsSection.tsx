import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  Spinner,
  TextField,
} from '@heroui/react';
import {
  IconAlertTriangle,
  IconDeviceFloppy,
  IconTrash,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  environmentFormSchema,
  type Environment,
  type EnvironmentFormValues,
} from '../models/environment';

const environmentNameSchema = environmentFormSchema.pick({ name: true });
type EnvironmentNameValues = Pick<EnvironmentFormValues, 'name'>;

interface EnvironmentSettingsSectionProps {
  environment: Environment;
  isDeleting: boolean;
  isSaving: boolean;
  onDelete: () => Promise<void>;
  onRename: (name: string) => Promise<void>;
}

export function EnvironmentSettingsSection({
  environment,
  isDeleting,
  isSaving,
  onDelete,
  onRename,
}: EnvironmentSettingsSectionProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    reset,
    setError,
  } = useForm<EnvironmentNameValues>({
    defaultValues: { name: environment.name },
    resolver: zodResolver(environmentNameSchema),
  });

  useEffect(() => {
    reset({ name: environment.name });
  }, [environment.id, environment.name, reset]);

  const submit = handleSubmit(async ({ name }) => {
    const normalizedName = name.trim();
    try {
      await onRename(normalizedName);
      reset({ name: normalizedName });
    } catch (error) {
      setError('name', {
        message:
          error instanceof Error
            ? error.message
            : 'The environment name could not be saved.',
      });
    }
  });

  async function confirmDelete() {
    setDeleteError(null);
    try {
      await onDelete();
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : 'The environment could not be deleted.',
      );
    }
  }

  return (
    <section
      aria-labelledby="environment-settings-heading"
      className="space-y-4"
    >
      <div>
        <h2 className="font-medium" id="environment-settings-heading">
          Environment settings
        </h2>
        <p className="text-sm text-muted">
          Rename this environment or remove it and its configured sources.
        </p>
      </div>

      <Form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        validationBehavior="aria"
      >
        <TextField
          className="min-w-0 flex-1"
          isInvalid={Boolean(errors.name)}
          variant="secondary"
        >
          <Label>Environment name</Label>
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <Input disabled={isSaving || isDeleting} {...field} />
            )}
          />
          <FieldError>{errors.name?.message}</FieldError>
        </TextField>
        <Button
          isDisabled={!isDirty || isSaving || isDeleting}
          size="sm"
          type="submit"
          variant="primary"
        >
          {isSaving ? (
            <Spinner aria-label="Saving environment name" size="sm" />
          ) : (
            <IconDeviceFloppy
              aria-hidden="true"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
          )}
          Save name
        </Button>
      </Form>

      <div className="border-t border-divider pt-4">
        {isConfirmingDelete ? (
          <div
            aria-labelledby="delete-environment-heading"
            className="space-y-3 rounded-md border border-danger/40 bg-danger/10 p-3"
            role="alert"
          >
            <div className="flex items-start gap-2">
              <IconAlertTriangle
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-danger"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
              <div>
                <h3
                  className="font-medium text-danger"
                  id="delete-environment-heading"
                >
                  Delete {environment.name}?
                </h3>
                <p className="mt-1 text-sm text-muted">
                  This removes the environment, its configured sources, and its
                  tracked key metadata. Project files are not deleted.
                </p>
              </div>
            </div>
            {deleteError ? (
              <p className="text-sm text-danger" role="alert">
                {deleteError}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                isDisabled={isDeleting}
                onPress={() => setIsConfirmingDelete(false)}
                size="sm"
                variant="secondary"
              >
                Keep environment
              </Button>
              <Button
                isDisabled={isDeleting}
                onPress={() => void confirmDelete()}
                size="sm"
                variant="danger"
              >
                {isDeleting ? (
                  <Spinner aria-label="Deleting environment" size="sm" />
                ) : (
                  <IconTrash
                    aria-hidden="true"
                    size={ICON_SIZE.small}
                    stroke={ICON_STROKE}
                  />
                )}
                Delete permanently
              </Button>
            </div>
          </div>
        ) : (
          <Button
            isDisabled={isSaving || isDeleting}
            onPress={() => setIsConfirmingDelete(true)}
            size="sm"
            variant="danger-soft"
          >
            <IconTrash
              aria-hidden="true"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
            Delete environment
          </Button>
        )}
      </div>
    </section>
  );
}
