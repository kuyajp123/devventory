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
import { IconBraces } from '@tabler/icons-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  environmentFormSchema,
  type EnvironmentFormValues,
  type ProjectEnvironment,
} from '../models/environment-tracker';

interface EnvironmentFormModalProps {
  environment: ProjectEnvironment | null;
  isOpen: boolean;
  isPending: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (values: EnvironmentFormValues) => Promise<void>;
}

export function EnvironmentFormModal({
  environment,
  isOpen,
  isPending,
  onOpenChange,
  onSubmit,
}: EnvironmentFormModalProps) {
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<EnvironmentFormValues>({
    defaultValues: { description: '', name: '' },
    resolver: zodResolver(environmentFormSchema),
  });

  useEffect(() => {
    reset({
      description: environment?.description ?? '',
      name: environment?.name ?? '',
    });
  }, [environment, isOpen, reset]);

  const submit = handleSubmit(onSubmit);

  return (
    <Modal>
      <Button aria-hidden="true" className="hidden">
        Open environment dialog
      </Button>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        variant="blur"
      >
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon>
                <IconBraces aria-hidden="true" />
              </Modal.Icon>
              <Modal.Heading>
                {environment ? 'Edit environment' : 'Add environment'}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <Form
                className="space-y-5"
                onSubmit={(event) => event.preventDefault()}
                validationBehavior="aria"
              >
                <TextField
                  fullWidth
                  isInvalid={Boolean(errors.name)}
                  variant="secondary"
                >
                  <Label>Environment name</Label>
                  <Input autoFocus {...register('name')} />
                  <FieldError>{errors.name?.message}</FieldError>
                </TextField>
                <TextField
                  fullWidth
                  isInvalid={Boolean(errors.description)}
                  variant="secondary"
                >
                  <Label>Description (optional)</Label>
                  <TextArea rows={3} {...register('description')} />
                  <FieldError>{errors.description?.message}</FieldError>
                </TextField>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button
                isDisabled={isPending}
                onPress={() => onOpenChange(false)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                isDisabled={isPending}
                onPress={() => void submit()}
                variant="primary"
              >
                {isPending ? (
                  <Spinner aria-label="Saving environment" size="sm" />
                ) : null}
                {isPending ? 'Saving…' : 'Save environment'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
