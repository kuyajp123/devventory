import {
  IconAlertTriangle,
  IconChevronDown,
  IconChevronLeft,
  IconCircleCheck,
  IconDatabase,
  IconExternalLink,
  IconLock,
  IconLockOpen,
  IconPlus,
  IconShieldLock,
  IconWorld,
  IconX,
} from '@tabler/icons-react';
import { Spinner } from '@heroui/react';
import { useEffect, useRef, useState } from 'react';
import {
  credentialKeySchema,
  credentialVaultGateway,
  type CredentialSource,
  type VaultStatus,
} from '@/features/credential-vault';
import {
  environmentTrackerGateway,
  type Environment,
} from '@/features/environment-tracker';
import { projectSelectionGateway } from '@/features/projects';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { preserveExactTextareaPaste } from '@/shared/ui';
import {
  openCredentialVaultFromQuickAccess,
  openMainWindowFromQuickAccess,
} from './services/quick-access.gateway';

interface EnvironmentKeyFlowProps {
  onClose: () => void;
}

export function EnvironmentKeyFlow({ onClose }: EnvironmentKeyFlowProps) {
  const [addedKeyName, setAddedKeyName] = useState('');
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [sources, setSources] = useState<CredentialSource[]>([]);
  const [value, setValue] = useState('');
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);

  const selectedEnvironment = environments.find(
    (environment) => environment.id === selectedEnvironmentId,
  );
  const selectedSource = sources.find(
    (source) => source.id === selectedSourceId,
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const activeProjectId =
          await projectSelectionGateway.getLastOpenedProjectId();
        if (!activeProjectId) {
          if (!cancelled) {
            setError(
              'Open a project in Devventory before adding an environment key.',
            );
            setIsLoading(false);
          }
          return;
        }
        const [nextEnvironments, nextStatus] = await Promise.all([
          environmentTrackerGateway.list(activeProjectId),
          credentialVaultGateway.status(),
        ]);
        const nextSources = nextStatus.isUnlocked
          ? await credentialVaultGateway.listSources()
          : [];
        if (cancelled) return;
        setProjectId(activeProjectId);
        setEnvironments(nextEnvironments);
        setSources(nextSources);
        setVaultStatus(nextStatus);
        setSelectedEnvironmentId(nextEnvironments[0]?.id ?? '');
        setSelectedSourceId(nextSources[0]?.id ?? '');
      } catch (cause) {
        if (!cancelled) {
          setError(
            commandError(cause, 'Credential metadata could not be loaded.'),
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoading && selectedSourceId) keyInputRef.current?.focus();
  }, [isLoading, selectedSourceId]);

  async function unlockVault() {
    if (!masterPassword) {
      setError('Enter the Credential Vault master password.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const nextStatus = await credentialVaultGateway.unlock(masterPassword);
      const nextSources = await credentialVaultGateway.listSources();
      setVaultStatus(nextStatus);
      setSources(nextSources);
      setSelectedSourceId(nextSources[0]?.id ?? '');
      setMasterPassword('');
    } catch (cause) {
      setError(commandError(cause, 'Credential Vault could not be unlocked.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function saveKey() {
    if (!projectId || !selectedEnvironmentId || !selectedSourceId) return;
    if (!vaultStatus?.isUnlocked) {
      setError('Unlock Credential Vault before adding a credential.');
      return;
    }
    const parsed = credentialKeySchema.safeParse(keyName);
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? 'Enter a valid credential key.',
      );
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await credentialVaultGateway.createCredentials(selectedSourceId, [
        {
          environmentLinks: [
            { environmentId: selectedEnvironmentId, projectId },
          ],
          key: parsed.data,
          projectIds: [projectId],
          ...(value.length > 0 ? { value } : {}),
        },
      ]);
      setAddedKeyName(parsed.data);
      setKeyName('');
      setValue('');
      setIsSuccess(true);
    } catch (cause) {
      setError(commandError(cause, 'The credential could not be added.'));
    } finally {
      setIsSaving(false);
    }
  }

  function addAnother() {
    setAddedKeyName('');
    setError(null);
    setIsSuccess(false);
    setKeyName('');
    setValue('');
  }

  if (isLoading) {
    return (
      <FlowFrame onClose={onClose}>
        <Spinner aria-label="Loading credential sources" size="sm" />
      </FlowFrame>
    );
  }

  if (environments.length === 0) {
    return (
      <FlowFrame onClose={onClose}>
        <EmptyFlow
          action="Open Environment Tracker"
          body="Create an environment before associating a credential key."
          onAction={() => void openMainWindowFromQuickAccess()}
          title="No environments yet"
        />
      </FlowFrame>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TaskHeader onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-3">
        {error ? (
          <div
            className="mb-2.5 rounded-lg border border-danger/30 bg-danger/10 p-2.5 font-mono text-[11px] leading-relaxed text-danger"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {!vaultStatus?.isConfigured ? (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3.5">
            <div className="flex items-start gap-2.5">
              <IconShieldLock className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div>
                <h4 className="font-mono text-xs font-semibold text-warning">
                  Set up Credential Vault first
                </h4>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Create a master password before viewing sources or adding
                  credentials.
                </p>
              </div>
            </div>
            <button
              className="mt-3 flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 font-mono text-xs font-semibold text-white"
              onClick={() => void openCredentialVaultFromQuickAccess()}
              type="button"
            >
              <IconExternalLink className="h-3.5 w-3.5" />
              Set up Credential Vault
            </button>
          </div>
        ) : !vaultStatus.isUnlocked ? (
          <div className="rounded-lg border border-border p-3.5">
            <div className="flex items-start gap-2.5">
              <IconLock className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <h4 className="font-mono text-xs font-semibold text-foreground">
                  Credential Vault is locked
                </h4>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Unlock it before viewing sources or adding credentials.
                </p>
              </div>
            </div>
            <label className="mt-3 block">
              <span className="mb-1 block font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                Vault master password
              </span>
              <input
                aria-label="Vault master password"
                className="h-9 w-full rounded-lg border border-border px-3 font-mono text-xs text-foreground focus:border-accent focus:outline-none"
                disabled={isSaving}
                onChange={(event) => setMasterPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void unlockVault();
                }}
                style={{ backgroundColor: 'var(--panel)' }}
                type="password"
                value={masterPassword}
              />
            </label>
            <button
              className="mt-3 flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 font-mono text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!masterPassword || isSaving}
              onClick={() => void unlockVault()}
              type="button"
            >
              {isSaving ? (
                <Spinner size="sm" />
              ) : (
                <IconLockOpen className="h-3.5 w-3.5" />
              )}
              Unlock vault
            </button>
          </div>
        ) : isSuccess ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <IconCircleCheck className="h-10 w-10 text-success" />
            <h3 className="mt-2.5 font-mono text-xs font-semibold text-foreground">
              Credential key added
            </h3>
            <p className="mt-1 font-mono text-xs font-bold text-accent">
              {addedKeyName}
            </p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              {selectedEnvironment?.name} · {selectedSource?.name}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                className="rounded-lg border border-border px-3 py-1.5 font-mono text-xs font-medium text-foreground"
                onClick={addAnother}
                style={{ backgroundColor: 'var(--panel)' }}
                type="button"
              >
                Add another
              </button>
              <button
                className="rounded-lg bg-accent px-4 py-1.5 font-mono text-xs font-semibold text-white"
                onClick={onClose}
                type="button"
              >
                Done
              </button>
            </div>
          </div>
        ) : sources.length === 0 ? (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3.5">
            <div className="flex items-start gap-2.5">
              <IconAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div>
                <h4 className="font-mono text-xs font-semibold text-warning">
                  No Credential Vault sources yet
                </h4>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Create a predefined or custom source in Credential Vault
                  first.
                </p>
              </div>
            </div>
            <button
              className="mt-3 flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 font-mono text-xs font-semibold text-white"
              onClick={() => void openCredentialVaultFromQuickAccess()}
              type="button"
            >
              <IconExternalLink className="h-3.5 w-3.5" />
              Open Credential Vault
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <ThemedSelect
              label="Choose environment"
              onSelect={(id) => {
                setSelectedEnvironmentId(id);
                setKeyName('');
                setValue('');
              }}
              options={environments.map((environment) => ({
                icon: <IconWorld className="h-3.5 w-3.5 text-accent" />,
                id: environment.id,
                name: environment.name,
              }))}
              placeholder="Select environment..."
              selectedId={selectedEnvironmentId}
            />
            <ThemedSelect
              label="Choose credential source"
              onSelect={(id) => {
                setSelectedSourceId(id);
                setKeyName('');
                setValue('');
              }}
              options={sources.map((source) => ({
                icon: <IconDatabase className="h-3.5 w-3.5 text-accent" />,
                id: source.id,
                name: source.name,
              }))}
              placeholder="Select source..."
              selectedId={selectedSourceId}
            />
            <label className="block">
              <span className="mb-1 block font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                Credential key
              </span>
              <input
                aria-label="Credential key"
                className="h-9 w-full rounded-lg border border-border px-3 font-mono text-xs text-foreground focus:border-accent focus:outline-none"
                disabled={isSaving}
                maxLength={255}
                onChange={(event) => setKeyName(event.target.value)}
                placeholder="SERVICE_ACCOUNT_JSON"
                ref={keyInputRef}
                style={{ backgroundColor: 'var(--panel)' }}
                value={keyName}
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                Value (optional)
              </span>
              <textarea
                aria-label="Credential value"
                className="min-h-16 w-full resize-y rounded-lg border border-border px-3 py-2 font-mono text-xs text-foreground focus:border-accent focus:outline-none"
                disabled={isSaving}
                onChange={(event) => setValue(event.target.value)}
                onPaste={(event) =>
                  preserveExactTextareaPaste(event, value, setValue)
                }
                placeholder="Exact token, JSON, PEM, or multiline value"
                style={{ backgroundColor: 'var(--panel)' }}
                value={value}
              />
            </label>
            <button
              className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 font-mono text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!keyName.trim() || isSaving}
              onClick={() => void saveKey()}
              type="button"
            >
              {isSaving ? (
                <Spinner size="sm" />
              ) : (
                <IconPlus className="h-3.5 w-3.5" />
              )}
              Add credential
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
      <button
        aria-label="Back to Quick Actions"
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
        onClick={onClose}
        type="button"
      >
        <IconChevronLeft className="h-3.5 w-3.5" />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wide">
          Back
        </span>
      </button>
      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground">
        Add Environment Key
      </span>
      <button aria-label="Close" onClick={onClose} type="button">
        <IconX className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}

function FlowFrame({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <TaskHeader onClose={onClose} />
      <div className="flex flex-1 items-center justify-center p-4">
        {children}
      </div>
    </div>
  );
}

function EmptyFlow({
  action,
  body,
  onAction,
  title,
}: {
  action: string;
  body: string;
  onAction: () => void;
  title: string;
}) {
  return (
    <div className="text-center">
      <h3 className="font-mono text-xs font-semibold text-foreground">
        {title}
      </h3>
      <p className="mt-1 text-[11px] text-muted-foreground">{body}</p>
      <button
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-mono text-xs font-medium text-foreground"
        onClick={onAction}
        type="button"
      >
        <IconExternalLink className="h-3.5 w-3.5 text-accent" /> {action}
      </button>
    </div>
  );
}

function ThemedSelect({
  label,
  onSelect,
  options,
  placeholder,
  selectedId,
}: {
  label: string;
  onSelect: (id: string) => void;
  options: Array<{ icon?: React.ReactNode; id: string; name: string }>;
  placeholder: string;
  selectedId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.id === selectedId);

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node))
        setIsOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <span className="mb-1 block font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <button
        aria-expanded={isOpen}
        aria-label={label}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-border px-3 font-mono text-xs text-foreground"
        onClick={() => setIsOpen((current) => !current)}
        style={{ backgroundColor: 'var(--panel)' }}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {selected?.icon}
          {selected?.name ?? placeholder}
        </span>
        <IconChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {isOpen ? (
        <div
          className="absolute z-50 mt-1 w-full rounded-lg border border-border p-1 shadow-lg"
          style={{ backgroundColor: 'var(--panel)' }}
        >
          {options.map((option) => (
            <button
              className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left font-mono text-xs text-foreground hover:bg-accent/10"
              key={option.id}
              onClick={() => {
                onSelect(option.id);
                setIsOpen(false);
              }}
              type="button"
            >
              {option.icon}
              {option.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function commandError(error: unknown, fallback: string): string {
  return error instanceof TauriCommandError ? error.message : fallback;
}
