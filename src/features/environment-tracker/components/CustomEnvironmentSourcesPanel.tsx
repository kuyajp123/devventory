import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Input,
  Label,
  Spinner,
  TextField,
  toast,
} from '@heroui/react';
import {
  IconCopy,
  IconDatabase,
  IconEdit,
  IconKey,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { ConfirmDialog, SemanticStatusChip } from '@/shared/ui';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import {
  useAddCustomEnvironmentKeyMutation,
  useCopyCustomEnvironmentKeyMutation,
  useCopyCustomEnvironmentSourceMutation,
  useCreateCustomEnvironmentSourceMutation,
  useCustomEnvironmentSourcesQuery,
  useDeleteCustomEnvironmentKeyMutation,
  useDeleteCustomEnvironmentSourceMutation,
  useRenameCustomEnvironmentSourceMutation,
} from '../hooks/use-environments';
import {
  customKeyFormSchema,
  customSourceFormSchema,
  type CustomEnvironmentKey,
  type CustomEnvironmentSource,
  type CustomSourceFormValues,
  type Environment,
} from '../models/environment';

interface CustomEnvironmentSourcesPanelProps {
  environment: Environment;
  environments: Environment[];
  projectId: string;
}

export function CustomEnvironmentSourcesPanel({
  environment,
  environments,
  projectId,
}: CustomEnvironmentSourcesPanelProps) {
  const sources = useCustomEnvironmentSourcesQuery(projectId, environment.id);
  const createSource = useCreateCustomEnvironmentSourceMutation(projectId);
  const [deleteCandidate, setDeleteCandidate] =
    useState<CustomEnvironmentSource | null>(null);
  const deleteSource = useDeleteCustomEnvironmentSourceMutation(projectId);
  const form = useForm<CustomSourceFormValues>({
    defaultValues: { keyNames: [], name: '' },
    resolver: zodResolver(customSourceFormSchema),
  });
  const [keyDraft, setKeyDraft] = useState('');
  const keyNames = useWatch({ control: form.control, name: 'keyNames' });

  function addDraftKey() {
    const name = keyDraft.trim();
    if (!name) return;
    if (
      keyNames.some(
        (key) => key.toLocaleUpperCase() === name.toLocaleUpperCase(),
      )
    ) {
      form.setError('keyNames', {
        message: 'That key is already in this source.',
      });
      return;
    }
    form.setValue('keyNames', [...keyNames, name], { shouldValidate: true });
    form.clearErrors('keyNames');
    setKeyDraft('');
  }

  const submit = form.handleSubmit(async (values) => {
    try {
      await createSource.mutateAsync({
        ...values,
        environmentId: environment.id,
      });
      form.reset();
      setKeyDraft('');
      toast.success('Custom source created');
    } catch (error) {
      form.setError('name', {
        message: errorMessage(error, 'The custom source could not be created.'),
      });
    }
  });

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-divider bg-surface-secondary/40 p-3">
        <div className="mb-3 flex items-start gap-2">
          <IconDatabase
            aria-hidden="true"
            className="mt-0.5 text-accent"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
          <div>
            <h3 className="text-xs font-semibold text-foreground">
              New custom source
            </h3>
            <p className="text-[11px] leading-relaxed text-muted">
              Track key names that do not come from a file. Devventory never
              asks for or stores values.
            </p>
          </div>
        </div>
        <form className="space-y-3" onSubmit={submit}>
          <TextField
            isInvalid={Boolean(form.formState.errors.name)}
            variant="secondary"
          >
            <Label>Source name</Label>
            <Input
              placeholder="Deployment secrets"
              {...form.register('name')}
            />
            {form.formState.errors.name?.message && (
              <p className="text-[11px] text-danger">
                {form.formState.errors.name.message}
              </p>
            )}
          </TextField>
          <div>
            <Label className="mb-1 block text-xs">
              Initial keys <span className="text-muted">(optional)</span>
            </Label>
            <div className="flex gap-2">
              <Input
                aria-label="Initial custom key"
                onChange={(event) => setKeyDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addDraftKey();
                  }
                }}
                placeholder="SERVICE_ACCOUNT_JSON or signing-key.p12"
                value={keyDraft}
              />
              <Button
                isDisabled={!keyDraft.trim()}
                onPress={addDraftKey}
                size="sm"
                variant="secondary"
              >
                <IconPlus
                  aria-hidden="true"
                  size={ICON_SIZE.small}
                  stroke={ICON_STROKE}
                />
                Add key
              </Button>
            </div>
            {form.formState.errors.keyNames?.message && (
              <p className="mt-1 text-[11px] text-danger">
                {form.formState.errors.keyNames.message}
              </p>
            )}
            {keyNames.length > 0 && (
              <ul
                aria-label="Initial custom keys"
                className="mt-2 flex flex-wrap gap-1.5"
              >
                {keyNames.map((name) => (
                  <li
                    className="flex items-center gap-1 rounded border border-divider bg-surface px-2 py-1 font-mono text-[10px]"
                    key={name}
                  >
                    {name}
                    <button
                      aria-label={`Remove ${name}`}
                      className="text-muted hover:text-danger"
                      onClick={() =>
                        form.setValue(
                          'keyNames',
                          keyNames.filter((key) => key !== name),
                        )
                      }
                      type="button"
                    >
                      <IconX
                        aria-hidden="true"
                        size={12}
                        stroke={ICON_STROKE}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex justify-end">
            <Button
              isPending={createSource.isPending}
              type="submit"
              variant="primary"
              size="sm"
            >
              <IconPlus
                aria-hidden="true"
                size={ICON_SIZE.small}
                stroke={ICON_STROKE}
              />
              Create custom source
            </Button>
          </div>
        </form>
      </div>

      {sources.isPending && (
        <Spinner aria-label="Loading custom sources" size="sm" />
      )}
      {sources.isError && (
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Custom sources unavailable</Alert.Title>
          </Alert.Content>
        </Alert>
      )}
      {sources.data?.length === 0 && (
        <div className="rounded-md border border-dashed border-divider p-5 text-center text-xs text-muted">
          No custom sources in {environment.name} yet.
        </div>
      )}
      <ul className="space-y-2">
        {sources.data?.map((source) => (
          <CustomSourceCard
            environment={environment}
            environments={environments}
            key={source.id}
            onDelete={() => setDeleteCandidate(source)}
            projectId={projectId}
            source={source}
          />
        ))}
      </ul>
      <ConfirmDialog
        body={
          deleteCandidate
            ? `Delete “${deleteCandidate.name}” and its ${deleteCandidate.keys.length} key definitions? File sources are not affected.`
            : null
        }
        isOpen={Boolean(deleteCandidate)}
        onConfirm={() => {
          if (!deleteCandidate) return;
          deleteSource.mutate(
            { environmentId: environment.id, sourceId: deleteCandidate.id },
            {
              onError: (error) =>
                toast.danger(
                  errorMessage(
                    error,
                    'The custom source could not be deleted.',
                  ),
                ),
              onSuccess: () => toast.success('Custom source deleted'),
            },
          );
        }}
        onOpenChange={(isOpen) => !isOpen && setDeleteCandidate(null)}
        title="Delete custom source?"
      />
    </div>
  );
}

function CustomSourceCard({
  environment,
  environments,
  onDelete,
  projectId,
  source,
}: CustomEnvironmentSourcesPanelProps & {
  onDelete: () => void;
  source: CustomEnvironmentSource;
}) {
  const renameSource = useRenameCustomEnvironmentSourceMutation(projectId);
  const addKey = useAddCustomEnvironmentKeyMutation(projectId);
  const deleteKey = useDeleteCustomEnvironmentKeyMutation(projectId);
  const copyKey = useCopyCustomEnvironmentKeyMutation(projectId);
  const copySource = useCopyCustomEnvironmentSourceMutation(projectId);
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(source.name);
  const [newKey, setNewKey] = useState('');
  const [sourceCopyEnvironmentId, setSourceCopyEnvironmentId] = useState('');
  const [keyTargetEnvironmentId, setKeyTargetEnvironmentId] = useState('');
  const targetSources = useCustomEnvironmentSourcesQuery(
    projectId,
    keyTargetEnvironmentId,
  );
  const [copyingKey, setCopyingKey] = useState<CustomEnvironmentKey | null>(
    null,
  );
  const [targetSourceId, setTargetSourceId] = useState('');

  async function saveName() {
    try {
      await renameSource.mutateAsync({
        environmentId: environment.id,
        name,
        sourceId: source.id,
      });
      setIsRenaming(false);
      toast.success('Custom source renamed');
    } catch (error) {
      toast.danger(
        errorMessage(error, 'The custom source could not be renamed.'),
      );
    }
  }

  async function submitKey(event: React.FormEvent) {
    event.preventDefault();
    const parsed = customKeyFormSchema.safeParse({ name: newKey });
    if (!parsed.success) return;
    try {
      await addKey.mutateAsync({
        environmentId: environment.id,
        name: parsed.data.name,
        sourceId: source.id,
      });
      setNewKey('');
      toast.success('Custom key added');
    } catch (error) {
      toast.danger(errorMessage(error, 'The custom key could not be added.'));
    }
  }

  const targets = environments.filter(
    (candidate) => candidate.id !== environment.id,
  );

  return (
    <li className="rounded-md border border-divider bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <div className="flex gap-2">
              <Input
                aria-label="Custom source name"
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
              <Button
                isDisabled={!name.trim()}
                isPending={renameSource.isPending}
                onPress={() => void saveName()}
                size="sm"
                variant="primary"
              >
                Save
              </Button>
              <Button
                onPress={() => {
                  setName(source.name);
                  setIsRenaming(false);
                }}
                size="sm"
                variant="ghost"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="truncate font-mono text-xs font-semibold">
                {source.name}
              </p>
              <SemanticStatusChip
                dataStatus="custom"
                label="Custom"
                tone="neutral"
              />
              <span className="text-[10px] text-muted">
                {source.keys.length} {source.keys.length === 1 ? 'key' : 'keys'}
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-1">
          <Button
            aria-label={`Rename ${source.name}`}
            isIconOnly
            onPress={() => setIsRenaming(true)}
            size="sm"
            variant="ghost"
          >
            <IconEdit
              aria-hidden="true"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
          </Button>
          <Button
            aria-label={`Delete ${source.name}`}
            isIconOnly
            onPress={onDelete}
            size="sm"
            variant="ghost"
          >
            <IconTrash
              aria-hidden="true"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
          </Button>
        </div>
      </div>

      <form className="mt-3 flex gap-2" onSubmit={submitKey}>
        <Input
          aria-label={`Add key to ${source.name}`}
          onChange={(event) => setNewKey(event.target.value)}
          placeholder="Add a metadata-only key name"
          value={newKey}
        />
        <Button
          isDisabled={!newKey.trim()}
          isPending={addKey.isPending}
          size="sm"
          type="submit"
          variant="secondary"
        >
          <IconPlus
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
          Add
        </Button>
      </form>

      {source.keys.length > 0 ? (
        <ul className="mt-3 divide-y divide-divider rounded border border-divider">
          {source.keys.map((key) => (
            <li className="flex items-center gap-2 px-2.5 py-2" key={key.id}>
              <IconKey
                aria-hidden="true"
                className="shrink-0 text-muted"
                size={ICON_SIZE.small}
                stroke={ICON_STROKE}
              />
              <span className="min-w-0 flex-1 truncate font-mono text-[11px]">
                {key.name}
              </span>
              <Button
                aria-label={`Copy ${key.name}`}
                isIconOnly
                onPress={() => {
                  setCopyingKey(key);
                  setKeyTargetEnvironmentId('');
                  setTargetSourceId('');
                }}
                size="sm"
                variant="ghost"
              >
                <IconCopy
                  aria-hidden="true"
                  size={ICON_SIZE.small}
                  stroke={ICON_STROKE}
                />
              </Button>
              <Button
                aria-label={`Delete ${key.name}`}
                isIconOnly
                onPress={() =>
                  deleteKey.mutate(
                    {
                      environmentId: environment.id,
                      keyId: key.id,
                      sourceId: source.id,
                    },
                    {
                      onError: (error) =>
                        toast.danger(
                          errorMessage(
                            error,
                            'The custom key could not be deleted.',
                          ),
                        ),
                      onSuccess: () => toast.success('Custom key deleted'),
                    },
                  )
                }
                size="sm"
                variant="ghost"
              >
                <IconTrash
                  aria-hidden="true"
                  size={ICON_SIZE.small}
                  stroke={ICON_STROKE}
                />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[11px] text-muted">
          No keys in this custom source.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-divider pt-3">
        <label className="min-w-44 flex-1 text-[10px] font-medium text-muted">
          Copy full source to environment
          <select
            className="mt-1 h-8 w-full rounded border border-divider bg-surface-secondary px-2 text-xs text-foreground"
            onChange={(event) => setSourceCopyEnvironmentId(event.target.value)}
            value={sourceCopyEnvironmentId}
          >
            <option value="">Choose environment</option>
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          isDisabled={!sourceCopyEnvironmentId || Boolean(copyingKey)}
          isPending={copySource.isPending}
          onPress={async () => {
            try {
              await copySource.mutateAsync({
                sourceId: source.id,
                targetEnvironmentId: sourceCopyEnvironmentId,
              });
              setSourceCopyEnvironmentId('');
              toast.success('Custom source copied');
            } catch (error) {
              toast.danger(
                errorMessage(error, 'The custom source could not be copied.'),
              );
            }
          }}
          size="sm"
          variant="secondary"
        >
          Copy source
        </Button>
      </div>

      {copyingKey && (
        <div className="mt-3 rounded border border-accent/30 bg-accent/5 p-3">
          <p className="mb-2 text-[11px]">
            Copy{' '}
            <span className="font-mono font-semibold">{copyingKey.name}</span>{' '}
            to another custom source.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[10px] font-medium text-muted">
              Environment
              <select
                className="mt-1 h-8 w-full rounded border border-divider bg-surface px-2 text-xs text-foreground"
                onChange={(event) => {
                  setKeyTargetEnvironmentId(event.target.value);
                  setTargetSourceId('');
                }}
                value={keyTargetEnvironmentId}
              >
                <option value="">Choose environment</option>
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-medium text-muted">
              Custom source
              <select
                className="mt-1 h-8 w-full rounded border border-divider bg-surface px-2 text-xs text-foreground"
                disabled={!keyTargetEnvironmentId || targetSources.isPending}
                onChange={(event) => setTargetSourceId(event.target.value)}
                value={targetSourceId}
              >
                <option value="">Choose source</option>
                {targetSources.data?.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {keyTargetEnvironmentId && targetSources.data?.length === 0 && (
            <p className="mt-2 text-[11px] text-warning">
              The target environment has no custom source yet.
            </p>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <Button
              onPress={() => setCopyingKey(null)}
              size="sm"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              isDisabled={!targetSourceId}
              isPending={copyKey.isPending}
              onPress={async () => {
                try {
                  await copyKey.mutateAsync({
                    keyId: copyingKey.id,
                    targetEnvironmentId: keyTargetEnvironmentId,
                    targetSourceId,
                  });
                  setCopyingKey(null);
                  toast.success('Custom key copied');
                } catch (error) {
                  toast.danger(
                    errorMessage(error, 'The custom key could not be copied.'),
                  );
                }
              }}
              size="sm"
              variant="primary"
            >
              Copy key
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof TauriCommandError ? error.message : fallback;
}
