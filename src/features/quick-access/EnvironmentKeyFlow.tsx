import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconCircleCheck,
  IconCode,
  IconDatabase,
  IconDeviceLaptop,
  IconExternalLink,
  IconFlame,
  IconInfoCircle,
  IconLayersDifference,
  IconPlus,
  IconWorld,
  IconX,
} from '@tabler/icons-react';
import { Spinner } from '@heroui/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  environmentTrackerGateway,
  type CustomEnvironmentSource,
  type Environment,
} from '@/features/environment-tracker';
import { projectSelectionGateway } from '@/features/projects';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { customKeyFormSchema } from '@/features/environment-tracker/models/environment';
import {
  openEnvironmentSettingsFromQuickAccess,
  openMainWindowFromQuickAccess,
} from './services/quick-access.gateway';

interface EnvironmentKeyFlowProps {
  onClose: () => void;
}

export function EnvironmentKeyFlow({ onClose }: EnvironmentKeyFlowProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState('');
  const [environmentConfirmed, setEnvironmentConfirmed] = useState(false);
  const [customSources, setCustomSources] = useState<CustomEnvironmentSource[]>(
    [],
  );
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [customSourceConfirmed, setCustomSourceConfirmed] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [addedKeyName, setAddedKeyName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const keyInputRef = useRef<HTMLInputElement>(null);
  const [needsInitialization, setNeedsInitialization] = useState(true);

  const selectedEnvironment = environments.find(
    (env) => env.id === selectedEnvironmentId,
  );
  const selectedSource = customSources.find(
    (source) => source.id === selectedSourceId,
  );

  const loadCustomSources = useCallback(
    async (projId: string, envId: string, preSelectFirst = true) => {
      setError(null);
      try {
        const sources = await environmentTrackerGateway.listCustomSources(
          projId,
          envId,
        );
        setCustomSources(sources);
        if (sources.length === 0) {
          setSelectedSourceId('');
          setCustomSourceConfirmed(false);
        } else if (preSelectFirst) {
          const firstId = sources[0].id;
          setSelectedSourceId(firstId);
          setCustomSourceConfirmed(true);
        }
      } catch (err) {
        setError(commandError(err, 'Custom sources could not be loaded.'));
      }
    },
    [],
  );

  const loadEnvironments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const activeProjectId =
        await projectSelectionGateway.getLastOpenedProjectId();
      if (!activeProjectId) {
        setProjectId(null);
        setEnvironments([]);
        setError('Open a project in Devventory before adding a custom key.');
        setIsLoading(false);
        return;
      }
      const nextEnvironments =
        await environmentTrackerGateway.list(activeProjectId);
      setProjectId(activeProjectId);
      setEnvironments(nextEnvironments);
      if (nextEnvironments.length > 0) {
        const firstEnvId = nextEnvironments[0].id;
        setSelectedEnvironmentId(firstEnvId);
        setEnvironmentConfirmed(true);
        await loadCustomSources(activeProjectId, firstEnvId, true);
      }
    } catch (err) {
      setError(commandError(err, 'Environment metadata could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, [loadCustomSources]);

  useEffect(() => {
    if (needsInitialization) {
      setNeedsInitialization(false);
      void loadEnvironments();
    }
  }, [needsInitialization, loadEnvironments]);

  useEffect(() => {
    if (customSourceConfirmed && keyInputRef.current) {
      keyInputRef.current.focus();
    }
  }, [customSourceConfirmed]);

  const handleSelectEnvironment = useCallback(
    async (envId: string) => {
      setEnvironmentConfirmed(true);
      setError(null);

      if (envId !== selectedEnvironmentId) {
        setSelectedEnvironmentId(envId);
        setSelectedSourceId('');
        setCustomSourceConfirmed(false);
        setKeyName('');
        if (projectId) {
          await loadCustomSources(projectId, envId, true);
        }
      } else {
        // Re-confirming same environment -> preserve source if still valid
        if (projectId && customSources.length === 0) {
          await loadCustomSources(projectId, envId, true);
        }
      }
    },
    [selectedEnvironmentId, projectId, customSources.length, loadCustomSources],
  );

  const handleSelectSource = useCallback(
    (sourceId: string) => {
      setCustomSourceConfirmed(true);
      setError(null);
      if (sourceId !== selectedSourceId) {
        setSelectedSourceId(sourceId);
        setKeyName('');
      }
    },
    [selectedSourceId],
  );

  const handleSaveKey = useCallback(async () => {
    const name = keyName.trim();
    if (!projectId || !selectedEnvironmentId || !selectedSourceId || !name) {
      return;
    }
    const parsed = customKeyFormSchema.safeParse({ name });
    if (!parsed.success) {
      setError('Enter a valid custom key name.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await environmentTrackerGateway.addCustomKey({
        environmentId: selectedEnvironmentId,
        name: parsed.data.name,
        projectId,
        sourceId: selectedSourceId,
      });
      setAddedKeyName(parsed.data.name);
      setKeyName('');
      setIsSuccess(true);
    } catch (err) {
      setError(commandError(err, 'The custom key could not be added.'));
    } finally {
      setIsSaving(false);
    }
  }, [keyName, projectId, selectedEnvironmentId, selectedSourceId]);

  const handleAddAnother = useCallback(() => {
    setKeyName('');
    setAddedKeyName('');
    setError(null);
    setIsSuccess(false);
  }, []);

  const handleOpenEnvironmentTracker = useCallback(() => {
    void openMainWindowFromQuickAccess();
  }, []);

  const handleOpenEnvironmentSettings = useCallback(() => {
    if (selectedEnvironmentId) {
      void openEnvironmentSettingsFromQuickAccess(selectedEnvironmentId);
    } else {
      void openMainWindowFromQuickAccess();
    }
  }, [selectedEnvironmentId]);

  const environmentOptions = environments.map((env) => ({
    id: env.id,
    name: env.name,
    icon: getEnvironmentIcon(env.name),
  }));

  const sourceOptions = customSources.map((source) => ({
    id: source.id,
    name: source.name,
    icon: <IconDatabase className="h-3.5 w-3.5 text-accent shrink-0" />,
  }));

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <button
            aria-label="Back to Quick Actions"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <IconChevronLeft className="h-3.5 w-3.5" />
            <span className="font-mono text-[10px] uppercase tracking-wide">
              Back
            </span>
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Spinner aria-label="Loading environments" size="sm" />
        </div>
      </div>
    );
  }

  if (environments.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <button
            aria-label="Back to Quick Actions"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <IconChevronLeft className="h-3.5 w-3.5" />
            <span className="font-mono text-[10px] uppercase tracking-wide">
              Back
            </span>
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <h3 className="font-mono text-xs font-semibold text-foreground">
            No environments yet
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Create an environment before adding custom environment keys.
          </p>
          <button
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-mono text-xs font-medium text-foreground transition-colors hover:border-accent/40"
            onClick={handleOpenEnvironmentTracker}
            style={{ backgroundColor: 'var(--panel)' }}
            type="button"
          >
            <IconExternalLink className="h-3.5 w-3.5 text-accent" />
            Open Environment Tracker
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Task Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
        <button
          aria-label="Back to Quick Actions"
          className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
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
        <button
          aria-label="Close"
          className="text-muted-foreground transition-colors hover:text-foreground"
          onClick={onClose}
          type="button"
        >
          <IconX className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Main Task Body */}
      <div className="flex-1 overflow-y-auto p-3">
        {error && (
          <div
            className="mb-2.5 rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-[11px] leading-relaxed text-danger font-mono"
            role="alert"
          >
            {error}
          </div>
        )}

        {isSuccess ? (
          /* Success Screen */
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <IconCircleCheck className="h-10 w-10 text-success" />
            <h3 className="mt-2.5 font-mono text-xs font-semibold text-foreground">
              Environment key added
            </h3>
            <p className="mt-1 font-mono text-xs font-bold text-accent">
              {addedKeyName}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground font-mono">
              {selectedEnvironment?.name}
              {' · '}
              {selectedSource?.name}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                className="rounded-lg border border-border px-3 py-1.5 font-mono text-xs font-medium text-foreground transition-colors hover:border-accent/40"
                onClick={handleAddAnother}
                style={{ backgroundColor: 'var(--panel)' }}
                type="button"
              >
                Add another
              </button>
              <button
                className="rounded-lg bg-accent px-4 py-1.5 font-mono text-xs font-semibold text-white transition-colors hover:bg-accent/90"
                onClick={onClose}
                type="button"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form Screen */
          <div className="space-y-3">
            {/* Step 1: Environment Selection */}
            <ThemedSelect
              label="Choose environment"
              options={environmentOptions}
              placeholder="Select environment..."
              selectedId={selectedEnvironmentId}
              onSelect={(id) => void handleSelectEnvironment(id)}
            />

            {/* Missing Custom Source Warning Card */}
            {environmentConfirmed && customSources.length === 0 && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3.5">
                <div className="flex items-start gap-2.5">
                  <IconAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                  <div>
                    <h4 className="font-mono text-xs font-semibold text-warning">
                      No custom sources in "{selectedEnvironment?.name}"
                    </h4>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      Create a Custom Source in the main app before adding a
                      Custom Key.
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 font-mono text-xs font-semibold text-white transition-colors hover:bg-accent/90"
                    onClick={handleOpenEnvironmentSettings}
                    type="button"
                  >
                    <IconExternalLink className="h-3.5 w-3.5" />
                    Open Environment Settings
                  </button>
                  <button
                    aria-label="Change environment"
                    className="rounded-lg border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                    onClick={onClose}
                    style={{ backgroundColor: 'var(--panel)' }}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Custom Source Selection */}
            {environmentConfirmed && customSources.length > 0 && (
              <ThemedSelect
                label="Choose custom source"
                options={sourceOptions}
                placeholder="Select custom source..."
                selectedId={selectedSourceId}
                onSelect={(id) => handleSelectSource(id)}
              />
            )}

            {/* Step 3: Key Name Input & Actions */}
            {environmentConfirmed &&
              customSources.length > 0 &&
              customSourceConfirmed && (
                <div className="pt-1 space-y-3">
                  <div>
                    <label className="block font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Custom key name
                    </label>
                    <input
                      ref={keyInputRef}
                      aria-label="Custom key name"
                      className="h-9 w-full rounded-lg border border-border px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                      disabled={isSaving}
                      onChange={(e) => setKeyName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && keyName.trim()) {
                          void handleSaveKey();
                        }
                      }}
                      placeholder="SERVICE_ACCOUNT_JSON"
                      style={{ backgroundColor: 'var(--panel)' }}
                      value={keyName}
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground/80">
                      Key names only. Values are never requested or stored.
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 font-mono text-xs font-semibold text-white transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!keyName.trim() || isSaving}
                      onClick={() => void handleSaveKey()}
                      type="button"
                    >
                      {isSaving ? (
                        <Spinner size="sm" />
                      ) : (
                        <>
                          <IconPlus className="h-3.5 w-3.5" />
                          <span>Add key</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80">
                      <IconInfoCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>After adding, only this field resets.</span>
                    </div>
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

function ThemedSelect({
  label,
  placeholder,
  options,
  selectedId,
  onSelect,
  disabled = false,
}: {
  label: string;
  placeholder: string;
  options: { id: string; name: string; icon?: React.ReactNode }[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.id === selectedId);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleOptionClick = (id: string) => {
    onSelect(id);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <span className="block font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </span>
      <button
        aria-expanded={isOpen}
        aria-label={label}
        className={`flex h-9 w-full items-center justify-between rounded-lg border px-3 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
          isOpen
            ? 'border-accent ring-1 ring-accent'
            : 'border-border hover:border-accent/60'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          backgroundColor: 'var(--panel)',
          color: 'var(--text-primary)',
        }}
        type="button"
      >
        <div className="flex items-center gap-2 truncate text-foreground">
          {selectedOption ? (
            <>
              {selectedOption.icon}
              <span className="truncate">{selectedOption.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <IconChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
            isOpen ? 'rotate-180 text-accent' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border p-1 shadow-2xl"
          style={{
            backgroundColor: 'var(--elevated)',
            color: 'var(--text-primary)',
          }}
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 font-mono text-xs text-muted-foreground">
              No options available
            </div>
          ) : (
            options.map((opt) => {
              const isSelected = opt.id === selectedId;
              return (
                <button
                  key={opt.id}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 font-mono text-xs text-left transition-colors ${
                    isSelected
                      ? 'bg-accent/20 text-accent font-semibold'
                      : 'text-foreground hover:bg-[var(--panel)] hover:text-accent'
                  }`}
                  onClick={() => handleOptionClick(opt.id)}
                  style={{
                    backgroundColor: isSelected
                      ? 'color-mix(in srgb, var(--accent) 20%, transparent)'
                      : 'transparent',
                  }}
                  type="button"
                >
                  {opt.icon}
                  <span className="truncate flex-1">{opt.name}</span>
                  {isSelected && (
                    <IconCheck className="h-3.5 w-3.5 shrink-0 text-accent" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function getEnvironmentIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('prod'))
    return <IconWorld className="h-3.5 w-3.5 text-accent shrink-0" />;
  if (lower.includes('local'))
    return <IconDeviceLaptop className="h-3.5 w-3.5 text-accent shrink-0" />;
  if (lower.includes('stage'))
    return (
      <IconLayersDifference className="h-3.5 w-3.5 text-accent shrink-0" />
    );
  if (lower.includes('dev'))
    return <IconCode className="h-3.5 w-3.5 text-accent shrink-0" />;
  if (lower.includes('fire'))
    return <IconFlame className="h-3.5 w-3.5 text-accent shrink-0" />;
  return <IconWorld className="h-3.5 w-3.5 text-accent shrink-0" />;
}

function commandError(error: unknown, fallback: string): string {
  return error instanceof TauriCommandError ? error.message : fallback;
}
