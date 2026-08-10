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
  IconCheck,
  IconEdit,
  IconTrash,
  IconX,
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

interface EnvironmentGeneralSectionProps {
  environment: Environment;
  isSaving: boolean;
  onRename: (name: string) => Promise<void>;
}

export function EnvironmentGeneralSection({
  environment,
  isSaving,
  onRename,
}: EnvironmentGeneralSectionProps) {
  const [editingEnvironmentId, setEditingEnvironmentId] = useState<
    string | null
  >(null);
  const isEditing = editingEnvironmentId === environment.id;

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
    if (normalizedName === environment.name) {
      setEditingEnvironmentId(null);
      return;
    }
    try {
      await onRename(normalizedName);
      setEditingEnvironmentId(null);
    } catch (error) {
      setError('name', {
        message:
          error instanceof Error
            ? error.message
            : 'The environment name could not be saved.',
      });
    }
  });

  return (
    <section aria-labelledby="general-settings-heading" className="space-y-4">
      <div>
        <h2
          className="font-medium text-foreground"
          id="general-settings-heading"
        >
          General Settings
        </h2>
        <p className="text-xs text-muted">
          Environment configuration metadata and identity.
        </p>
      </div>

      <div className="rounded-md border border-divider bg-surface-secondary/50 p-4">
        {!isEditing ? (
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Environment name
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-lg font-semibold text-foreground">
                {environment.name}
              </span>
              <Button
                aria-label={`Edit name for environment ${environment.name}`}
                isIconOnly
                onPress={() => setEditingEnvironmentId(environment.id)}
                size="sm"
                variant="ghost"
              >
                <IconEdit
                  aria-hidden="true"
                  size={ICON_SIZE.small}
                  stroke={ICON_STROKE}
                />
              </Button>
            </div>
            {environment.description && (
              <p className="mt-2 text-xs text-muted leading-relaxed">
                {environment.description}
              </p>
            )}
          </div>
        ) : (
          <Form
            className="space-y-3"
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
                  <Input
                    autoFocus
                    disabled={isSaving}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        reset({ name: environment.name });
                        setEditingEnvironmentId(null);
                      }
                    }}
                    {...field}
                  />
                )}
              />
              <FieldError>{errors.name?.message}</FieldError>
            </TextField>
            <div className="flex gap-2 justify-end">
              <Button
                isDisabled={isSaving}
                onPress={() => {
                  reset({ name: environment.name });
                  setEditingEnvironmentId(null);
                }}
                size="sm"
                variant="secondary"
              >
                <IconX
                  aria-hidden="true"
                  size={ICON_SIZE.small}
                  stroke={ICON_STROKE}
                />
                Cancel
              </Button>
              <Button
                isDisabled={!isDirty || isSaving}
                size="sm"
                type="submit"
                variant="primary"
              >
                {isSaving ? (
                  <Spinner aria-label="Saving name" size="sm" />
                ) : (
                  <IconCheck
                    aria-hidden="true"
                    size={ICON_SIZE.small}
                    stroke={ICON_STROKE}
                  />
                )}
                Save name
              </Button>
            </div>
          </Form>
        )}
      </div>
    </section>
  );
}

interface EnvironmentDangerZoneSectionProps {
  environment: Environment;
  isDeleting: boolean;
  onDelete: () => void;
}

export function EnvironmentDangerZoneSection({
  environment,
  isDeleting,
  onDelete,
}: EnvironmentDangerZoneSectionProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  return (
    <section aria-labelledby="danger-zone-heading" className="space-y-4">
      <div>
        <h2 className="font-medium text-danger" id="danger-zone-heading">
          Danger Zone
        </h2>
        <p className="text-xs text-muted">
          Destructive actions for this environment configuration.
        </p>
      </div>

      <div className="rounded-md border border-danger/30 bg-danger/5 p-4 space-y-3">
        {isConfirmingDelete ? (
          <div
            aria-labelledby="delete-environment-heading"
            className="space-y-3"
            role="alert"
          >
            <div className="flex items-start gap-2.5">
              <IconAlertTriangle
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-danger"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
              <div>
                <h3
                  className="font-medium text-danger text-sm"
                  id="delete-environment-heading"
                >
                  Delete {environment.name}?
                </h3>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  This removes the environment, its configured sources, and its
                  tracked key metadata. Project files on disk are not deleted.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
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
                onPress={onDelete}
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
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-foreground">
                Delete environment
              </p>
              <p className="text-[11px] text-muted">
                Removes this environment configuration and tracked keys.
              </p>
            </div>
            <Button
              isDisabled={isDeleting}
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
          </div>
        )}
      </div>
    </section>
  );
}
