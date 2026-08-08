import { Button, Input, Label, TextField, toast } from '@heroui/react';
import { IconAlertTriangle, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import {
  DevventoryDialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '@/shared/ui';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import type { Project } from '../models/project';
import { useDeleteProjectMutation } from '../hooks/use-projects';

interface ProjectDeleteControlProps {
  project: Project;
}

export function ProjectDeleteControl({ project }: ProjectDeleteControlProps) {
  const deleteProject = useDeleteProjectMutation();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const isConfirmed = confirmation === project.name;

  function changeOpen(nextIsOpen: boolean) {
    setIsOpen(nextIsOpen);
    if (!nextIsOpen) setConfirmation('');
  }

  async function confirmDelete() {
    if (!isConfirmed) return;
    try {
      await deleteProject.mutateAsync(project.id);
      changeOpen(false);
      toast.success(`${project.name} was removed from Devventory.`);
    } catch {
      toast.danger(
        'Devventory could not delete this project registration. Try again.',
      );
    }
  }

  return (
    <>
      <section className="rounded-md border border-danger/30 bg-danger/5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-danger">
              Danger zone
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
              Remove this project and its Devventory metadata. The local project
              folder and its files stay unchanged.
            </p>
          </div>
          <Button
            className="shrink-0"
            onPress={() => setIsOpen(true)}
            size="sm"
            variant="danger"
          >
            <IconTrash
              aria-hidden="true"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
            Delete project
          </Button>
        </div>
      </section>

      <DevventoryDialog isOpen={isOpen} onOpenChange={changeOpen} size="sm">
        <DialogHeader
          description="This removes only Devventory's local database records."
          icon={
            <IconAlertTriangle
              className="text-danger"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
          }
          title={`Delete ${project.name}?`}
        />
        <DialogBody className="space-y-4">
          <p className="text-sm leading-6 text-foreground">
            This permanently removes the project configuration, inventory, asset
            metadata, environments, validation data, and search history stored
            by Devventory. It does not delete the project folder or any files on
            disk.
          </p>
          <TextField fullWidth variant="secondary">
            <Label>Project name</Label>
            <Input
              autoComplete="off"
              autoFocus
              disabled={deleteProject.isPending}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={project.name}
              value={confirmation}
            />
            <p className="text-xs text-muted">
              Type{' '}
              <span className="font-mono text-foreground">{project.name}</span>{' '}
              to confirm.
            </p>
          </TextField>
        </DialogBody>
        <DialogFooter>
          <Button
            isDisabled={deleteProject.isPending}
            onPress={() => changeOpen(false)}
            size="sm"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            isDisabled={!isConfirmed || deleteProject.isPending}
            isPending={deleteProject.isPending}
            onPress={() => void confirmDelete()}
            size="sm"
            variant="danger"
          >
            Permanently delete project
          </Button>
        </DialogFooter>
      </DevventoryDialog>
    </>
  );
}
