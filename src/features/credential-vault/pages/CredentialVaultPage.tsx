import { useQueries } from '@tanstack/react-query';
import { Alert, Button, Input, Spinner, TextField, toast } from '@heroui/react';
import {
  IconCopy,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconKey,
  IconLock,
  IconLockOpen,
  IconPlus,
  IconSearch,
  IconShieldLock,
  IconTrash,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import {
  environmentTrackerGateway,
  type Environment,
} from '@/features/environment-tracker';
import { useProjectsQuery, type Project } from '@/features/projects';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { ConfirmDialog } from '@/shared/ui';
import {
  useCreateCredentialSourceMutation,
  useCreateCredentialsMutation,
  useCredentialSourcesQuery,
  useCredentialsQuery,
  useCredentialVaultStatusQuery,
  useDeleteCredentialMutation,
  useDeleteCredentialSourceMutation,
  useLockCredentialVaultMutation,
  useRemoveCredentialSecretMutation,
  useReplaceCredentialSecretMutation,
  useUnlockCredentialVaultMutation,
  useUpdateCredentialMutation,
  useUpdateCredentialSourceMutation,
} from '../hooks/use-credential-vault';
import {
  type Credential,
  type CredentialDraft,
  type CredentialSource,
} from '../models/credential-vault';
import { credentialVaultGateway } from '../services/credential-vault.gateway';
import { CredentialEditorDialog } from '../components/CredentialEditorDialog';
import {
  CredentialSourceDialog,
  type CredentialSourceValues,
} from '../components/CredentialSourceDialog';
import { CredentialValueDialog } from '../components/CredentialValueDialog';
import { SourceLogo } from '../components/SourceLogo';
import { VaultUnlockDialog } from '../components/VaultUnlockDialog';

type DeleteTarget =
  | { kind: 'credential'; value: Credential }
  | { kind: 'source'; value: CredentialSource }
  | null;

export function CredentialVaultPage() {
  const status = useCredentialVaultStatusQuery();
  const isUnlocked = status.data?.isUnlocked ?? false;
  const sources = useCredentialSourcesQuery(isUnlocked);
  const credentials = useCredentialsQuery(undefined, isUnlocked);
  const projects = useProjectsQuery();
  const environments = useAllEnvironments(projects.data ?? []);
  const unlock = useUnlockCredentialVaultMutation();
  const lock = useLockCredentialVaultMutation();
  const createSource = useCreateCredentialSourceMutation();
  const updateSource = useUpdateCredentialSourceMutation();
  const deleteSource = useDeleteCredentialSourceMutation();
  const createCredentials = useCreateCredentialsMutation();
  const updateCredential = useUpdateCredentialMutation();
  const replaceSecret = useReplaceCredentialSecretMutation();
  const removeSecret = useRemoveCredentialSecretMutation();
  const deleteCredential = useDeleteCredentialMutation();

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [editingCredential, setEditingCredential] = useState<Credential | null>(
    null,
  );
  const [editingSource, setEditingSource] = useState<CredentialSource | null>(
    null,
  );
  const [environmentFilter, setEnvironmentFilter] = useState('all');
  const [isCredentialDialogOpen, setCredentialDialogOpen] = useState(false);
  const [isSourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [isUnlockOpen, setUnlockOpen] = useState(false);
  const [isSetupDismissed, setSetupDismissed] = useState(false);
  const [isValueDialogOpen, setValueDialogOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState('all');
  const [revealedSecret, setRevealedSecret] = useState<{
    credentialId: string;
    value: string;
  } | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCredentialId, setSelectedCredentialId] = useState<
    string | null
  >(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  const sourceItems = useMemo(() => sources.data ?? [], [sources.data]);
  const credentialItems = useMemo(
    () => credentials.data ?? [],
    [credentials.data],
  );
  const filteredSources = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return sourceItems.filter((source) => {
      const matchesSearch =
        !needle ||
        source.name.toLowerCase().includes(needle) ||
        credentialItems.some(
          (credential) =>
            credential.sourceId === source.id &&
            credential.key.toLowerCase().includes(needle),
        );
      const matchesProject =
        projectFilter === 'all' || source.projectIds.includes(projectFilter);
      return matchesSearch && matchesProject;
    });
  }, [credentialItems, projectFilter, search, sourceItems]);

  const activeSourceId =
    selectedSourceId &&
    filteredSources.some((source) => source.id === selectedSourceId)
      ? selectedSourceId
      : (filteredSources[0]?.id ?? null);

  const selectedSource =
    sourceItems.find((source) => source.id === activeSourceId) ?? null;
  const filteredCredentials = useMemo(
    () =>
      credentialItems.filter((credential) => {
        if (credential.sourceId !== activeSourceId) return false;
        if (
          projectFilter !== 'all' &&
          !credential.projectIds.includes(projectFilter)
        ) {
          return false;
        }
        if (
          environmentFilter !== 'all' &&
          !credential.environmentLinks.some(
            (link) => link.environmentId === environmentFilter,
          )
        ) {
          return false;
        }
        const needle = search.trim().toLowerCase();
        return (
          !needle ||
          credential.key.toLowerCase().includes(needle) ||
          credential.notes?.toLowerCase().includes(needle)
        );
      }),
    [credentialItems, environmentFilter, projectFilter, search, activeSourceId],
  );

  const activeCredentialId =
    selectedCredentialId &&
    filteredCredentials.some((item) => item.id === selectedCredentialId)
      ? selectedCredentialId
      : (filteredCredentials[0]?.id ?? null);

  const selectedCredential =
    credentialItems.find((item) => item.id === activeCredentialId) ?? null;
  const revealedValue =
    revealedSecret?.credentialId === activeCredentialId
      ? revealedSecret.value
      : null;
  const shouldShowUnlock =
    isUnlockOpen ||
    Boolean(status.data && !status.data.isConfigured && !isSetupDismissed);
  const isLoading =
    status.isPending ||
    (isUnlocked && (sources.isPending || credentials.isPending));

  async function safely(action: () => Promise<void>, fallback: string) {
    try {
      await action();
    } catch (error) {
      toast.danger(commandError(error, fallback));
    }
  }

  async function reveal() {
    if (!selectedCredential) return;
    if (revealedValue !== null) {
      setRevealedSecret(null);
      return;
    }
    try {
      setRevealedSecret({
        credentialId: selectedCredential.id,
        value: await credentialVaultGateway.revealSecret(selectedCredential.id),
      });
    } catch (error) {
      toast.danger(
        commandError(error, 'The encrypted value could not be revealed.'),
      );
    }
  }

  async function copyValue() {
    if (!selectedCredential) return;
    try {
      const value = await credentialVaultGateway.revealSecret(
        selectedCredential.id,
      );
      await navigator.clipboard.writeText(value);
      toast.success('Credential value copied.');
    } catch (error) {
      toast.danger(
        commandError(error, 'The encrypted value could not be copied.'),
      );
    }
  }

  async function saveSource(values: CredentialSourceValues) {
    await safely(async () => {
      if (editingSource) {
        await updateSource.mutateAsync({
          ...values,
          sourceId: editingSource.id,
        });
        toast.success('Credential source updated.');
      } else {
        const created = await createSource.mutateAsync(values);
        setSelectedSourceId(created.id);
        toast.success('Credential source created.');
      }
      setSourceDialogOpen(false);
      setEditingSource(null);
    }, 'The credential source could not be saved.');
  }

  async function saveCredentials(sourceId: string, drafts: CredentialDraft[]) {
    await safely(async () => {
      const created = await createCredentials.mutateAsync({
        credentials: drafts,
        sourceId,
      });
      setSelectedSourceId(sourceId);
      setSelectedCredentialId(created[0]?.id ?? null);
      setCredentialDialogOpen(false);
      toast.success(
        created.length === 1
          ? 'Credential created.'
          : `${created.length} credentials created.`,
      );
    }, 'The credentials could not be created.');
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await safely(async () => {
      if (deleteTarget.kind === 'source') {
        await deleteSource.mutateAsync(deleteTarget.value.id);
        toast.success('Credential source deleted.');
      } else {
        await deleteCredential.mutateAsync(deleteTarget.value.id);
        toast.success('Credential deleted.');
      }
      setDeleteTarget(null);
    }, 'The selected vault record could not be deleted.');
  }

  const unlockDialog = shouldShowUnlock ? (
    <VaultUnlockDialog
      isConfigured={status.data?.isConfigured ?? false}
      isOpen
      isUnlocking={unlock.isPending}
      onOpenChange={(isOpen) => {
        setUnlockOpen(isOpen);
        if (!isOpen && !status.data?.isConfigured) {
          setSetupDismissed(true);
        }
      }}
      onUnlock={async (password) => {
        await unlock.mutateAsync(password);
        toast.success(
          status.data?.isConfigured
            ? 'Credential Vault unlocked.'
            : 'Credential Vault created and unlocked.',
        );
      }}
    />
  ) : null;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner aria-label="Loading Credential Vault" />
      </div>
    );
  }

  if (
    status.isError ||
    (isUnlocked && (sources.isError || credentials.isError))
  ) {
    return (
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Credential Vault is unavailable</Alert.Title>
          <Alert.Description>
            Local vault metadata could not be loaded. Restart Devventory and try
            again.
          </Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  if (!isUnlocked) {
    const isConfigured = status.data?.isConfigured ?? false;
    return (
      <div className="-mx-4 -mb-4 flex h-full min-h-0 flex-1 flex-col overflow-hidden sm:-mx-6 sm:-mb-6 lg:-mx-8 lg:-mb-8">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-divider px-4 pb-4 sm:px-6 lg:px-8">
          <div>
            <div className="flex items-center gap-2">
              <IconShieldLock
                className="text-accent"
                size={ICON_SIZE.navigation}
                stroke={ICON_STROKE}
              />
              <h1 className="font-mono text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Credential Vault
              </h1>
              <span className="rounded border border-warning/30 bg-warning/10 px-2 py-0.5 font-mono text-[10px] text-warning">
                LOCKED
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Sources, credential metadata, associations, and encrypted values
              are protected by your master password.
            </p>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 items-center justify-center p-6">
          <section className="w-full max-w-md rounded-lg border border-divider bg-surface p-6 text-center shadow-sm">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-accent">
              <IconLock size={22} stroke={ICON_STROKE} />
            </span>
            <h2 className="mt-4 font-mono text-base font-bold text-foreground">
              {isConfigured
                ? 'Credential Vault is locked'
                : 'Set up Credential Vault'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {isConfigured
                ? 'Enter your master password before viewing or changing credential sources, keys, notes, associations, or values.'
                : 'Create a master password before viewing or adding credential sources, keys, notes, associations, or values.'}
            </p>
            <Button
              className="mt-5"
              onPress={() => {
                setSetupDismissed(false);
                setUnlockOpen(true);
              }}
              variant="primary"
            >
              {isConfigured ? (
                <IconLockOpen size={ICON_SIZE.small} stroke={ICON_STROKE} />
              ) : (
                <IconShieldLock size={ICON_SIZE.small} stroke={ICON_STROKE} />
              )}
              {isConfigured ? 'Unlock vault' : 'Set up vault'}
            </Button>
          </section>
        </main>
        {unlockDialog}
      </div>
    );
  }

  return (
    <div className="-mx-4 -mb-4 flex h-full min-h-0 flex-1 flex-col overflow-hidden sm:-mx-6 sm:-mb-6 lg:-mx-8 lg:-mb-8">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-divider px-4 pb-4 sm:px-6 lg:px-8">
        <div>
          <div className="flex items-center gap-2">
            <IconShieldLock
              className="text-accent"
              size={ICON_SIZE.navigation}
              stroke={ICON_STROKE}
            />
            <h1 className="font-mono text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Credential Vault
            </h1>
            <span
              className={`rounded border px-2 py-0.5 font-mono text-[10px] ${
                isUnlocked
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-warning/30 bg-warning/10 text-warning'
              }`}
            >
              {isUnlocked ? 'UNLOCKED' : 'LOCKED'}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Global source and credential metadata with optional
            Stronghold-encrypted values.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isUnlocked ? (
            <Button
              isDisabled={lock.isPending}
              onPress={() => {
                setRevealedSecret(null);
                void lock
                  .mutateAsync()
                  .catch((error) =>
                    toast.danger(
                      commandError(error, 'The vault could not be locked.'),
                    ),
                  );
              }}
              size="sm"
              variant="secondary"
            >
              <IconLock size={ICON_SIZE.small} stroke={ICON_STROKE} />
              Lock vault
            </Button>
          ) : (
            <Button
              onPress={() => setUnlockOpen(true)}
              size="sm"
              variant="secondary"
            >
              <IconLockOpen size={ICON_SIZE.small} stroke={ICON_STROKE} />
              {status.data?.isConfigured ? 'Unlock vault' : 'Set up vault'}
            </Button>
          )}
          <Button
            onPress={() => {
              setEditingSource(null);
              setSourceDialogOpen(true);
            }}
            size="sm"
            variant="secondary"
          >
            <IconPlus size={ICON_SIZE.small} stroke={ICON_STROKE} />
            New source
          </Button>
          <Button
            isDisabled={sourceItems.length === 0}
            onPress={() => {
              setEditingCredential(null);
              setCredentialDialogOpen(true);
            }}
            size="sm"
            variant="primary"
          >
            <IconPlus size={ICON_SIZE.small} stroke={ICON_STROKE} />
            New credential
          </Button>
        </div>
      </header>

      {!isUnlocked && status.data?.isConfigured ? (
        <div className="shrink-0 border-b border-divider bg-warning/5 px-4 py-2 sm:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-xs text-warning">
            <IconLock size={14} stroke={ICON_STROKE} />
            Metadata remains available while locked. Reveal, copy, replace, and
            secret-bearing deletes require this process session to be unlocked.
          </p>
        </div>
      ) : null}

      <div className="grid h-full min-h-0 grid-cols-[270px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="flex min-h-0 flex-col border-r border-divider bg-surface">
          <div className="space-y-2 border-b border-divider p-3">
            <TextField variant="secondary">
              <div className="relative">
                <IconSearch
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
                  size={14}
                  stroke={ICON_STROKE}
                />
                <Input
                  aria-label="Search credential sources and keys"
                  className="h-8 pl-8 font-mono text-xs"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search sources or keys..."
                  value={search}
                />
              </div>
            </TextField>
            <div className="grid grid-cols-2 gap-2">
              <FilterSelect
                label="Filter by project"
                onChange={setProjectFilter}
                options={(projects.data ?? []).map((project) => ({
                  label: project.name,
                  value: project.id,
                }))}
                value={projectFilter}
              />
              <FilterSelect
                label="Filter by environment"
                onChange={setEnvironmentFilter}
                options={environments.map((environment) => ({
                  label: environment.name,
                  value: environment.id,
                }))}
                value={environmentFilter}
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {filteredSources.map((source) => (
              <button
                className={`mb-1 flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left transition-colors ${
                  source.id === activeSourceId
                    ? 'border-accent/35 bg-accent/10'
                    : 'border-transparent hover:border-divider hover:bg-panel'
                }`}
                key={source.id}
                onClick={() => {
                  setSelectedSourceId(source.id);
                  setSelectedCredentialId(null);
                  setRevealedSecret(null);
                }}
                type="button"
              >
                <SourceLogo source={source} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {source.name}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] text-muted">
                    {source.credentialCount} credential
                    {source.credentialCount === 1 ? '' : 's'}
                  </span>
                </span>
              </button>
            ))}
            {filteredSources.length === 0 ? (
              <div className="p-4 text-center">
                <IconKey
                  className="mx-auto text-muted"
                  size={28}
                  stroke={ICON_STROKE}
                />
                <p className="mt-3 text-sm font-medium text-foreground">
                  {sourceItems.length === 0
                    ? 'No credential sources yet'
                    : 'No sources match'}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {sourceItems.length === 0
                    ? 'Create a predefined or custom source to establish your vault.'
                    : 'Clear the search or filters to see other sources.'}
                </p>
              </div>
            ) : null}
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col bg-workspace">
          {selectedSource ? (
            <>
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-divider bg-surface px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <SourceLogo className="h-8 w-8" source={selectedSource} />
                  <div className="min-w-0">
                    <h2 className="truncate font-mono text-base font-semibold text-foreground">
                      {selectedSource.name}
                    </h2>
                    <p className="truncate text-xs text-muted">
                      {selectedSource.description ?? 'No source description'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    aria-label={`Edit ${selectedSource.name}`}
                    isIconOnly
                    onPress={() => {
                      setEditingSource(selectedSource);
                      setSourceDialogOpen(true);
                    }}
                    size="sm"
                    variant="secondary"
                  >
                    <IconEdit size={ICON_SIZE.small} stroke={ICON_STROKE} />
                  </Button>
                  <Button
                    onPress={() => {
                      setEditingCredential(null);
                      setCredentialDialogOpen(true);
                    }}
                    size="sm"
                    variant="primary"
                  >
                    <IconPlus size={ICON_SIZE.small} stroke={ICON_STROKE} />
                    Add credential
                  </Button>
                </div>
              </div>
              <div className="grid shrink-0 grid-cols-[minmax(180px,1.4fr)_minmax(130px,1fr)_110px_100px] border-b border-divider bg-surface-secondary/40 px-4 py-2 font-mono text-[10px] uppercase tracking-wide text-muted">
                <span>Credential key</span>
                <span>Projects / environments</span>
                <span>Updated</span>
                <span>Value</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {filteredCredentials.map((credential) => (
                  <button
                    className={`grid w-full grid-cols-[minmax(180px,1.4fr)_minmax(130px,1fr)_110px_100px] items-center border-b border-divider px-4 py-4 text-left transition-colors ${
                      credential.id === activeCredentialId
                        ? 'bg-accent/8'
                        : 'hover:bg-panel'
                    }`}
                    key={credential.id}
                    onClick={() => {
                      setSelectedCredentialId(credential.id);
                      setRevealedSecret(null);
                    }}
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-xs font-semibold text-foreground">
                        {credential.key}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted">
                        {credential.notes ?? 'No notes'}
                      </span>
                    </span>
                    <span className="text-xs text-muted">
                      {credential.projectIds.length} project
                      {credential.projectIds.length === 1 ? '' : 's'} ·{' '}
                      {credential.environmentLinks.length} env
                    </span>
                    <span className="font-mono text-[10px] text-muted">
                      {formatShortDate(credential.updatedAt)}
                    </span>
                    <span
                      className={`font-mono text-[10px] ${
                        credential.hasValue ? 'text-success' : 'text-muted'
                      }`}
                    >
                      {credential.hasValue ? 'ENCRYPTED' : 'NONE'}
                    </span>
                  </button>
                ))}
                {filteredCredentials.length === 0 ? (
                  <div className="flex h-full min-h-56 items-center justify-center p-8 text-center">
                    <div>
                      <IconKey
                        className="mx-auto text-muted"
                        size={32}
                        stroke={ICON_STROKE}
                      />
                      <h3 className="mt-3 text-sm font-semibold text-foreground">
                        No credentials in this view
                      </h3>
                      <p className="mt-1 max-w-sm text-xs text-muted">
                        Add a key with an optional encrypted value, or clear the
                        current filters.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div>
                <IconShieldLock
                  className="mx-auto text-accent"
                  size={40}
                  stroke={ICON_STROKE}
                />
                <h2 className="mt-4 text-lg font-semibold text-foreground">
                  Build your source of truth
                </h2>
                <p className="mt-2 max-w-md text-sm text-muted">
                  Create one source instance for each provider, organization, or
                  custom credential group you manage.
                </p>
                <Button
                  className="mt-5"
                  onPress={() => setSourceDialogOpen(true)}
                  variant="primary"
                >
                  <IconPlus size={ICON_SIZE.small} stroke={ICON_STROKE} />
                  Create first source
                </Button>
              </div>
            </div>
          )}
        </main>

        <aside className="hidden min-h-0 flex-col border-l border-divider bg-surface xl:flex">
          {selectedCredential && selectedSource ? (
            <CredentialDetail
              credential={selectedCredential}
              environments={environments}
              isUnlocked={isUnlocked}
              onCopy={() => void copyValue()}
              onDelete={() =>
                setDeleteTarget({
                  kind: 'credential',
                  value: selectedCredential,
                })
              }
              onEdit={() => {
                setEditingCredential(selectedCredential);
                setCredentialDialogOpen(true);
              }}
              onRemoveValue={() =>
                void safely(async () => {
                  await removeSecret.mutateAsync(selectedCredential.id);
                  setRevealedSecret(null);
                  toast.success('Encrypted value removed.');
                }, 'The encrypted value could not be removed.')
              }
              onReplaceValue={() => setValueDialogOpen(true)}
              onReveal={() => void reveal()}
              projects={projects.data ?? []}
              revealedValue={revealedValue}
              source={selectedSource}
            />
          ) : selectedSource ? (
            <SourceDetail
              onDelete={() =>
                setDeleteTarget({ kind: 'source', value: selectedSource })
              }
              onEdit={() => {
                setEditingSource(selectedSource);
                setSourceDialogOpen(true);
              }}
              projects={projects.data ?? []}
              source={selectedSource}
            />
          ) : null}
        </aside>
      </div>

      {unlockDialog}
      {isSourceDialogOpen ? (
        <CredentialSourceDialog
          isOpen
          isSaving={createSource.isPending || updateSource.isPending}
          onOpenChange={(isOpen) => {
            setSourceDialogOpen(isOpen);
            if (!isOpen) setEditingSource(null);
          }}
          onSubmit={saveSource}
          projects={projects.data ?? []}
          source={editingSource}
        />
      ) : null}
      {isCredentialDialogOpen ? (
        <CredentialEditorDialog
          credential={editingCredential}
          initialSourceId={activeSourceId}
          isOpen
          isSaving={createCredentials.isPending || updateCredential.isPending}
          onCreate={saveCredentials}
          onOpenChange={(isOpen) => {
            setCredentialDialogOpen(isOpen);
            if (!isOpen) setEditingCredential(null);
          }}
          onUpdate={async (input) => {
            await safely(async () => {
              await updateCredential.mutateAsync(input);
              setCredentialDialogOpen(false);
              setEditingCredential(null);
              toast.success('Credential updated.');
            }, 'The credential could not be updated.');
          }}
          projects={projects.data ?? []}
          sources={sourceItems}
        />
      ) : null}
      {selectedCredential && isValueDialogOpen ? (
        <CredentialValueDialog
          credentialKey={selectedCredential.key}
          isOpen
          isSaving={replaceSecret.isPending}
          onOpenChange={setValueDialogOpen}
          onSave={async (value) => {
            await safely(async () => {
              await replaceSecret.mutateAsync({
                credentialId: selectedCredential.id,
                value,
              });
              setRevealedSecret(null);
              setValueDialogOpen(false);
              toast.success('Encrypted value saved.');
            }, 'The encrypted value could not be saved.');
          }}
        />
      ) : null}
      <ConfirmDialog
        body={
          deleteTarget?.kind === 'source'
            ? 'This removes the source, all of its credential metadata, associations, and encrypted values.'
            : 'This removes the credential metadata, associations, and encrypted value.'
        }
        isOpen={deleteTarget !== null}
        onConfirm={() => void confirmDelete()}
        onOpenChange={(isOpen) => !isOpen && setDeleteTarget(null)}
        title={
          deleteTarget?.kind === 'source'
            ? `Delete ${deleteTarget.value.name}?`
            : `Delete ${deleteTarget?.value.key ?? 'credential'}?`
        }
      />
    </div>
  );
}

function CredentialDetail({
  credential,
  environments,
  isUnlocked,
  onCopy,
  onDelete,
  onEdit,
  onRemoveValue,
  onReplaceValue,
  onReveal,
  projects,
  revealedValue,
  source,
}: {
  credential: Credential;
  environments: Environment[];
  isUnlocked: boolean;
  onCopy: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onRemoveValue: () => void;
  onReplaceValue: () => void;
  onReveal: () => void;
  projects: Project[];
  revealedValue: string | null;
  source: CredentialSource;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="flex items-center gap-3">
        <SourceLogo source={source} />
        <div className="min-w-0">
          <p className="truncate text-xs text-muted">{source.name}</p>
          <h2 className="truncate font-mono text-sm font-semibold text-foreground">
            {credential.key}
          </h2>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button onPress={onEdit} size="sm" variant="secondary">
          <IconEdit size={ICON_SIZE.small} stroke={ICON_STROKE} /> Edit
        </Button>
        <Button
          isDisabled={!credential.hasValue || !isUnlocked}
          onPress={onReveal}
          size="sm"
          variant="secondary"
        >
          {revealedValue === null ? (
            <IconEye size={ICON_SIZE.small} stroke={ICON_STROKE} />
          ) : (
            <IconEyeOff size={ICON_SIZE.small} stroke={ICON_STROKE} />
          )}
          {revealedValue === null ? 'Reveal' : 'Hide'}
        </Button>
        <Button
          isDisabled={!credential.hasValue || !isUnlocked}
          onPress={onCopy}
          size="sm"
          variant="secondary"
        >
          <IconCopy size={ICON_SIZE.small} stroke={ICON_STROKE} /> Copy
        </Button>
        <Button
          isDisabled={!isUnlocked}
          onPress={onReplaceValue}
          size="sm"
          variant="primary"
        >
          <IconShieldLock size={ICON_SIZE.small} stroke={ICON_STROKE} />
          {credential.hasValue ? 'Replace' : 'Add value'}
        </Button>
      </div>

      <DetailSection title="Value">
        {revealedValue !== null ? (
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded border border-success/25 bg-success/5 p-3 font-mono text-[11px] text-foreground select-text">
            {revealedValue}
          </pre>
        ) : (
          <div className="rounded border border-divider bg-workspace p-3 font-mono text-xs text-muted">
            {credential.hasValue
              ? '••••••••••••••••'
              : 'No encrypted value stored'}
          </div>
        )}
      </DetailSection>

      <DetailSection title="Associations">
        <TagList
          empty="No projects"
          values={credential.projectIds.map(
            (id) => projects.find((item) => item.id === id)?.name ?? id,
          )}
        />
        <TagList
          empty="No environments"
          values={credential.environmentLinks.map(
            (link) =>
              environments.find((item) => item.id === link.environmentId)
                ?.name ?? link.environmentId,
          )}
        />
      </DetailSection>

      <DetailSection title="Notes">
        <p className="text-xs leading-relaxed text-muted">
          {credential.notes ?? 'No notes for this credential.'}
        </p>
      </DetailSection>

      <div className="mt-5 space-y-2 border-t border-divider pt-4">
        {credential.hasValue ? (
          <Button
            fullWidth
            isDisabled={!isUnlocked}
            onPress={onRemoveValue}
            size="sm"
            variant="secondary"
          >
            Remove encrypted value
          </Button>
        ) : null}
        <Button fullWidth onPress={onDelete} size="sm" variant="danger">
          <IconTrash size={ICON_SIZE.small} stroke={ICON_STROKE} />
          Delete credential
        </Button>
      </div>
    </div>
  );
}

function SourceDetail({
  onDelete,
  onEdit,
  projects,
  source,
}: {
  onDelete: () => void;
  onEdit: () => void;
  projects: Project[];
  source: CredentialSource;
}) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <SourceLogo source={source} />
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {source.name}
          </h2>
          <p className="font-mono text-[10px] text-muted">
            {source.definitionKey ? 'PREDEFINED' : 'CUSTOM'} SOURCE
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted">
        {source.description ?? 'No source description.'}
      </p>
      <DetailSection title="Broad project scope">
        <TagList
          empty="Global, with no project association"
          values={source.projectIds.map(
            (id) => projects.find((item) => item.id === id)?.name ?? id,
          )}
        />
      </DetailSection>
      <div className="mt-5 grid gap-2">
        <Button onPress={onEdit} size="sm" variant="secondary">
          <IconEdit size={ICON_SIZE.small} stroke={ICON_STROKE} /> Edit source
        </Button>
        <Button onPress={onDelete} size="sm" variant="danger">
          <IconTrash size={ICON_SIZE.small} stroke={ICON_STROKE} /> Delete
          source
        </Button>
      </div>
    </div>
  );
}

function DetailSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="mt-5 border-t border-divider pt-4">
      <h3 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

function TagList({ empty, values }: { empty: string; values: string[] }) {
  if (values.length === 0) return <p className="text-xs text-muted">{empty}</p>;
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {values.map((value) => (
        <span
          className="rounded border border-accent/25 bg-accent/8 px-2 py-1 text-[10px] text-accent"
          key={value}
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <select
      aria-label={label}
      className="h-8 min-w-0 rounded border border-divider bg-workspace px-2 font-mono text-[10px] text-foreground outline-none focus:border-accent"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      <option value="all">All</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function useAllEnvironments(projects: Project[]): Environment[] {
  const queries = useQueries({
    queries: projects.map((project) => ({
      queryFn: () => environmentTrackerGateway.list(project.id),
      queryKey: ['environment-tracker', project.id, 'list'],
    })),
  });
  return queries.flatMap((query) => query.data ?? []);
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
      }).format(date);
}

function commandError(error: unknown, fallback: string): string {
  return error instanceof TauriCommandError ? error.message : fallback;
}
