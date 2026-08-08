import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  Spinner,
  TextArea,
  TextField,
} from '@heroui/react';
import { IconAdjustments } from '@tabler/icons-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  DevventoryDialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '@/shared/ui';
import {
  environmentFormSchema,
  type Environment,
  type EnvironmentFormValues,
} from '../models/environment';

interface EnvironmentFormModalProps {
  environment: Environment | null;
  isOpen: boolean;
  isSaving: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (values: EnvironmentFormValues) => Promise<void>;
}

export function EnvironmentFormModal({
  environment,
  isOpen,
  isSaving,
  onOpenChange,
  onSubmit,
}: EnvironmentFormModalProps) {
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<EnvironmentFormValues>({
    defaultValues: {
      description: environment?.description ?? '',
      name: environment?.name ?? '',
    },
    resolver: zodResolver(environmentFormSchema),
  });

  useEffect(() => {
    reset({
      description: environment?.description ?? '',
      name: environment?.name ?? '',
    });
  }, [environment, reset]);

  const submit = handleSubmit(async (values) => {
    await onSubmit({
      ...(values.description.trim()
        ? { description: values.description.trim() }
        : {}),
      name: values.name.trim(),
    } as EnvironmentFormValues);
  });

  return (
    <DevventoryDialog isOpen={isOpen} onOpenChange={onOpenChange} size="sm">
      <DialogHeader
        icon={
          <IconAdjustments
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
        }
        title={environment ? 'Edit environment' : 'Create environment'}
      />
      <DialogBody>
        <Form
          className="flex flex-col gap-3"
          onSubmit={(event) => event.preventDefault()}
          validationBehavior="aria"
        >
          <TextField
            fullWidth
            isInvalid={Boolean(errors.name)}
            variant="secondary"
          >
            <Label>Environment name</Label>
            <Input
              autoFocus
              disabled={isSaving}
              placeholder="Development"
              {...register('name')}
            />
            <FieldError>{errors.name?.message}</FieldError>
          </TextField>
          <TextField
            fullWidth
            isInvalid={Boolean(errors.description)}
            variant="secondary"
          >
            <Label>Description (optional)</Label>
            <TextArea
              disabled={isSaving}
              placeholder="Local development configuration"
              rows={3}
              {...register('description')}
            />
            <FieldError>{errors.description?.message}</FieldError>
          </TextField>
        </Form>
      </DialogBody>
      <DialogFooter>
        <Button
          isDisabled={isSaving}
          onPress={() => onOpenChange(false)}
          variant="secondary"
          size="sm"
        >
          Cancel
        </Button>
        <Button
          isDisabled={isSaving}
          onPress={() => void submit()}
          variant="primary"
          size="sm"
        >
          {isSaving && <Spinner aria-label="Saving environment" size="sm" />}
          {environment ? 'Save environment' : 'Create environment'}
        </Button>
      </DialogFooter>
    </DevventoryDialog>
  );
}
