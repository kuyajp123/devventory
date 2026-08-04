import { Alert, Button, Modal, Spinner } from '@heroui/react';
import { IconTrash } from '@tabler/icons-react';
import type { ProjectEnvironment } from '../models/environment-tracker';

interface DeleteEnvironmentModalProps {
  environment: ProjectEnvironment | null;
  isPending: boolean;
  onConfirm: () => Promise<void>;
  onOpenChange: (isOpen: boolean) => void;
}

export function DeleteEnvironmentModal({
  environment,
  isPending,
  onConfirm,
  onOpenChange,
}: DeleteEnvironmentModalProps) {
  return (
    <Modal>
      <Button aria-hidden="true" className="hidden">
        Open deletion confirmation
      </Button>
      <Modal.Backdrop
        isOpen={Boolean(environment)}
        onOpenChange={onOpenChange}
        variant="blur"
      >
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon>
                <IconTrash aria-hidden="true" />
              </Modal.Icon>
              <Modal.Heading>Remove environment</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <Alert status="warning">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>
                    Remove {environment?.name ?? 'this environment'}?
                  </Alert.Title>
                  <Alert.Description>
                    Its source configuration and stored key metadata will be
                    removed. Devventory will not delete any source file from the
                    project.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
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
                onPress={() => void onConfirm()}
                variant="danger"
              >
                {isPending ? (
                  <Spinner aria-label="Removing environment" size="sm" />
                ) : null}
                {isPending ? 'Removing…' : 'Remove environment'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
