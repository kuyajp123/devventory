import {
  Button,
  Form,
  Input,
  Label,
  Spinner,
  TextField,
  toast,
} from '@heroui/react';
import { IconFileExport, IconShieldLock } from '@tabler/icons-react';
import { useState } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import {
  ConfirmDialog,
  DevventoryDialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '@/shared/ui';
import {
  useExportManifestMutation,
  useManifestPreviewMutation,
} from '../hooks/use-validation-center';

export function ManifestExportDialog({
  isOpen,
  onOpenChange,
  projectId,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  projectId: string;
}) {
  const [relativePath, setRelativePath] = useState('.env.example');
  const [isReplaceConfirmationOpen, setIsReplaceConfirmationOpen] =
    useState(false);
  const preview = useManifestPreviewMutation(projectId);
  const exportManifest = useExportManifestMutation(projectId);

  function handleOpenChange(nextIsOpen: boolean) {
    if (!nextIsOpen) {
      setRelativePath('.env.example');
      preview.reset();
      exportManifest.reset();
    }
    onOpenChange(nextIsOpen);
  }

  async function loadPreview() {
    try {
      await preview.mutateAsync(relativePath.trim());
    } catch (error) {
      toast.danger(
        safeError(error, 'The manifest preview could not be generated.'),
      );
    }
  }

  async function writeManifest(collisionChoice: 'cancel' | 'replace') {
    try {
      const result = await exportManifest.mutateAsync({
        collisionChoice,
        relativePath: relativePath.trim(),
      });
      toast.success(
        `${result.replaced ? 'Replaced' : 'Created'} ${result.relativePath} with ${result.keyCount} empty-value keys.`,
      );
      handleOpenChange(false);
    } catch (error) {
      toast.danger(safeError(error, 'The manifest could not be exported.'));
    }
  }

  return (
    <>
      <DevventoryDialog
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
        size="lg"
        scroll
      >
        <DialogHeader
          icon={
            <IconFileExport
              aria-hidden="true"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
          }
          title="Preview environment manifest"
        />
        <DialogBody>
          <div className="space-y-4">
            <div className="flex gap-3 rounded-md border border-success/30 bg-success/10 p-3">
              <IconShieldLock
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-success"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Empty values only
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Devventory exports canonical key names with blank assignments.
                  It never copies tracked environment values.
                </p>
              </div>
            </div>
            <Form
              onSubmit={(event) => event.preventDefault()}
              validationBehavior="aria"
            >
              <TextField fullWidth variant="secondary">
                <Label>Destination (project-relative)</Label>
                <Input
                  disabled={preview.isPending || exportManifest.isPending}
                  maxLength={1024}
                  onChange={(event) => setRelativePath(event.target.value)}
                  placeholder=".env.example"
                  value={relativePath}
                />
              </TextField>
            </Form>
            {preview.data && (
              <div className="rounded-md border border-divider bg-workspace">
                <div className="flex items-center justify-between border-b border-divider px-3 py-2 text-xs">
                  <span className="font-medium">
                    {preview.data.keyCount} keys
                  </span>
                  <span
                    className={
                      preview.data.exists ? 'text-warning' : 'text-success'
                    }
                  >
                    {preview.data.exists
                      ? 'Destination exists · confirmation required'
                      : 'New file'}
                  </span>
                </div>
                <pre className="max-h-72 overflow-auto p-3 font-mono text-xs text-secondary select-text">
                  {preview.data.content || '# No tracked key definitions yet\n'}
                </pre>
              </div>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            isDisabled={exportManifest.isPending}
            onPress={() => handleOpenChange(false)}
            size="sm"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            isDisabled={
              !relativePath.trim() ||
              preview.isPending ||
              exportManifest.isPending
            }
            onPress={() => void loadPreview()}
            size="sm"
            variant="secondary"
          >
            {preview.isPending && (
              <Spinner aria-label="Generating manifest preview" size="sm" />
            )}
            Preview
          </Button>
          <Button
            isDisabled={!preview.data || exportManifest.isPending}
            onPress={() => {
              if (preview.data?.exists) setIsReplaceConfirmationOpen(true);
              else void writeManifest('cancel');
            }}
            size="sm"
            variant="primary"
          >
            {exportManifest.isPending && (
              <Spinner aria-label="Exporting manifest" size="sm" />
            )}
            {preview.data?.exists ? 'Replace manifest' : 'Export manifest'}
          </Button>
        </DialogFooter>
      </DevventoryDialog>
      <ConfirmDialog
        body={`Replace ${preview.data?.relativePath ?? relativePath}? The write is atomic, but the existing file content will be replaced with empty assignments.`}
        isOpen={isReplaceConfirmationOpen}
        onConfirm={() => void writeManifest('replace')}
        onOpenChange={setIsReplaceConfirmationOpen}
        title="Replace existing manifest"
      />
    </>
  );
}

function safeError(error: unknown, fallback: string): string {
  return error instanceof TauriCommandError ? error.message : fallback;
}
