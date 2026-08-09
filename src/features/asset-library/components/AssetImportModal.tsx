import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Form, Spinner, toast } from '@heroui/react';
import { IconFileImport } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import {
  DevventoryDialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '@/shared/ui';
import {
  useImportAssetMutation,
  usePreviewAssetMutation,
  useSelectAssetSourceMutation,
} from '../hooks/use-assets';
import {
  assetImportFormSchema,
  parseTags,
  type AssetImportFormValues,
} from '../models/asset';
import { AssetImportFields } from './AssetImportFields';
import { AssetImportSourcePanel } from './AssetImportSourcePanel';
import { AssetOperationError } from './AssetOperationError';

interface AssetImportModalProps {
  initialDestination?: string;
  initialSourcePath: string | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  projectId: string;
  watchedLocations: string[];
}

export function AssetImportModal({
  initialDestination,
  initialSourcePath,
  isOpen,
  onOpenChange,
  projectId,
  watchedLocations,
}: AssetImportModalProps) {
  const picker = useSelectAssetSourceMutation();
  const preview = usePreviewAssetMutation(projectId);
  const importer = useImportAssetMutation(projectId);
  const [sourcePath, setSourcePath] = useState<string | null>(
    initialSourcePath,
  );
  const [operationError, setOperationError] = useState<string | null>(null);
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<AssetImportFormValues>({
    defaultValues: {
      collision: 'cancel',
      destination: initialDestination ?? watchedLocations[0] ?? '.',
      favorite: false,
      filename: '',
      note: '',
      tagsText: '',
    },
    resolver: zodResolver(assetImportFormSchema),
  });

  const previewFile = preview.mutate;
  useEffect(() => {
    if (initialSourcePath) {
      previewFile(initialSourcePath, {
        onError: (error) => {
          setOperationError(
            errorMessage(error, 'The selected file could not be inspected.'),
          );
        },
      });
    }
  }, [initialSourcePath, previewFile]);

  const isBusy = picker.isPending || preview.isPending || importer.isPending;

  async function loadPreview(path: string) {
    setOperationError(null);
    setSourcePath(path);
    try {
      await preview.mutateAsync(path);
    } catch (error) {
      setOperationError(
        errorMessage(error, 'The selected file could not be inspected.'),
      );
    }
  }

  async function chooseFile() {
    try {
      const selected = await picker.mutateAsync();
      if (selected) await loadPreview(selected);
    } catch (error) {
      setOperationError(
        errorMessage(error, 'The native file picker is unavailable.'),
      );
    }
  }

  const submit = handleSubmit(async (values) => {
    if (!sourcePath || !preview.data) {
      setOperationError(
        'Choose a readable file and review its metadata first.',
      );
      return;
    }
    setOperationError(null);
    try {
      const result = await importer.mutateAsync({
        collision: values.collision,
        destination: values.destination,
        favorite: values.favorite,
        filename: values.filename || undefined,
        note: values.note || undefined,
        sourcePath,
        tags: parseTags(values.tagsText),
      });
      if (result.status === 'cancelled') {
        setOperationError(
          'A file already exists at this destination. Choose Replace, Keep both, or Rename to continue.',
        );
        toast.warning('Import cancelled without making changes');
        return;
      }
      toast.success('Asset imported and indexed');
      onOpenChange(false);
    } catch (error) {
      setOperationError(
        errorMessage(error, 'The asset could not be imported.'),
      );
    }
  });

  return (
    <DevventoryDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="lg"
      scroll
    >
      <DialogHeader
        icon={<IconFileImport aria-hidden="true" />}
        title="Import managed asset"
      />
      <DialogBody>
        <Form
          className="flex flex-col gap-5"
          onSubmit={(event) => event.preventDefault()}
          validationBehavior="aria"
        >
          <AssetImportSourcePanel
            isBusy={isBusy}
            isPreviewing={preview.isPending}
            onChoose={() => void chooseFile()}
            preview={preview.data}
            projectId={projectId}
            sourcePath={sourcePath}
          />

          <AssetImportFields
            control={control}
            errors={errors}
            isDisabled={isBusy || !preview.data}
            register={register}
            watchedLocations={watchedLocations}
          />

          {operationError && <AssetOperationError message={operationError} />}
        </Form>
      </DialogBody>
      <DialogFooter>
        <Button
          isDisabled={isBusy}
          onPress={() => onOpenChange(false)}
          variant="secondary"
          size="sm"
        >
          Close
        </Button>
        <Button
          isDisabled={isBusy || !preview.data}
          onPress={() => void submit()}
          variant="primary"
          size="sm"
        >
          {importer.isPending ? (
            <Spinner aria-label="Importing asset" size="sm" />
          ) : null}
          {importer.isPending ? 'Importing…' : 'Import and index'}
        </Button>
      </DialogFooter>
    </DevventoryDialog>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof TauriCommandError ? error.message : fallback;
}
