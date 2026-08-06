import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  Modal,
  Spinner,
  TextArea,
  TextField,
} from '@heroui/react';
import { IconAdjustments } from '@tabler/icons-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
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
    <Modal>
      <Button aria-hidden="true" className="hidden">
        Open environment form
      </Button>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        variant="blur"
      >
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon>
                <IconAdjustments
                  aria-hidden="true"
                  size={ICON_SIZE.button}
                  stroke={ICON_STROKE}
                />
              </Modal.Icon>
              <Modal.Heading>
                {environment ? 'Edit environment' : 'Create environment'}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <Form
                className="space-y-4"
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
            </Modal.Body>
            <Modal.Footer>
              <Button
                isDisabled={isSaving}
                onPress={() => onOpenChange(false)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                isDisabled={isSaving}
                onPress={() => void submit()}
                variant="primary"
              >
                {isSaving && (
                  <Spinner aria-label="Saving environment" size="sm" />
                )}
                {environment ? 'Save environment' : 'Create environment'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
