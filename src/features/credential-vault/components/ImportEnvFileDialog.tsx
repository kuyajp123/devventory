import {
  Alert,
  Button,
  Checkbox,
  Chip,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  SearchField,
  Select,
  Spinner,
  TextField,
} from '@heroui/react';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconEye,
  IconFileCode,
  IconFolder,
  IconInfoCircle,
  IconKey,
  IconLock,
  IconRefresh,
  IconShieldCheck,
  IconShieldLock,
} from '@tabler/icons-react';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { type Environment } from '@/features/environment-tracker';
import type { Project } from '@/features/projects';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { DevventoryDialog, DialogFooter, DialogHeader } from '@/shared/ui';
import {
  type CredentialSource,
  type EnvSecretPreviewItem,
  type ImportEnvSecretsResult,
} from '../models/credential-vault';
import { credentialVaultGateway } from '../services/credential-vault.gateway';

export interface ImportEnvFileValues {
  environmentId?: string;
  projectId: string;
  relativePath: string;
  selectedKeys: string[];
  sourceId?: string;
  sourceName?: string;
}

export type ImportStep = 'file' | 'keys' | 'destination' | 'complete';

function toRelativeProjectPath(
  fullPath: string,
  rootPath: string,
): string | null {
  const normFull = fullPath.replace(/\\/g, '/');
  const normRoot = rootPath.replace(/\\/g, '/').replace(/\/+$/, '');

  if (normFull.toLowerCase().startsWith(normRoot.toLowerCase() + '/')) {
    return normFull.slice(normRoot.length + 1);
  }
  if (normFull.toLowerCase() === normRoot.toLowerCase()) {
    return '';
  }
  return null;
}

export function ImportEnvFileDialog({
  environments,
  isOpen,
  isSaving,
  onOpenChange,
  onSubmit,
  projects,
  sources,
  targetProjectId,
}: {
  environments: Environment[];
  isOpen: boolean;
  isSaving: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (
    values: ImportEnvFileValues,
  ) => Promise<ImportEnvSecretsResult | void>;
  projects: Project[];
  sources: CredentialSource[];
  targetProjectId: string | null;
}) {
  const [currentStep, setCurrentStep] = useState<ImportStep>('file');

  const effectiveProjectId =
    (targetProjectId && projects.some((p) => p.id === targetProjectId)
      ? targetProjectId
      : projects[0]?.id) ?? '';
  const [selectedProjectIdOverride, setSelectedProjectIdOverride] = useState<
    string | null
  >(null);
  const selectedProjectId = selectedProjectIdOverride ?? effectiveProjectId;

  const [selectedRelativePath, setSelectedRelativePath] =
    useState<string>('.env');
  const [newSourceName, setNewSourceName] = useState<string>('.env');
  const [customSelectedKeys, setCustomSelectedKeys] =
    useState<Set<string> | null>(null);

  const [keySearchQuery, setKeySearchQuery] = useState<string>('');
  const [targetMode, setTargetMode] = useState<'new' | 'existing'>('new');
  const [existingSourceId, setExistingSourceId] = useState<string>('');
  const [selectedEnvironmentId, setSelectedEnvironmentId] =
    useState<string>('');
  const [stepError, setStepError] = useState<string | null>(null);

  const [importResult, setImportResult] =
    useState<ImportEnvSecretsResult | null>(null);

  // Preview keys from selected env file
  const previewQuery = useQuery({
    enabled:
      isOpen && Boolean(selectedProjectId && selectedRelativePath.trim()),
    queryFn: () =>
      credentialVaultGateway.previewEnvSecrets(
        selectedProjectId,
        selectedRelativePath.trim(),
      ),
    queryKey: [
      'credential-vault',
      'preview-env',
      selectedProjectId,
      selectedRelativePath.trim(),
    ],
  });

  const previewItems: EnvSecretPreviewItem[] = useMemo(
    () => previewQuery.data ?? [],
    [previewQuery.data],
  );

  const activeItems = useMemo(
    () => previewItems.filter((item) => !item.isCommented),
    [previewItems],
  );

  const commentedItems = useMemo(
    () => previewItems.filter((item) => item.isCommented),
    [previewItems],
  );

  // Detect active duplicate keys
  const activeKeyLineMap = useMemo(() => {
    const map = new Map<string, { key: string; lineNumbers: number[] }>();
    for (const item of activeItems) {
      const norm = item.key.toUpperCase();
      const existing = map.get(norm);
      if (existing) {
        existing.lineNumbers.push(item.lineNumber);
      } else {
        map.set(norm, { key: item.key, lineNumbers: [item.lineNumber] });
      }
    }
    return map;
  }, [activeItems]);

  const activeDuplicates = useMemo(() => {
    return Array.from(activeKeyLineMap.values()).filter(
      (entry) => entry.lineNumbers.length > 1,
    );
  }, [activeKeyLineMap]);

  const duplicateKeySet = useMemo(() => {
    return new Set(activeDuplicates.map((d) => d.key.toUpperCase()));
  }, [activeDuplicates]);

  const hasActiveDuplicates = activeDuplicates.length > 0;

  const defaultSelectedKeys = useMemo(() => {
    return new Set(activeItems.map((item) => item.key));
  }, [activeItems]);

  const selectedKeys = customSelectedKeys ?? defaultSelectedKeys;

  const filteredPreviewItems = useMemo(() => {
    const query = keySearchQuery.trim().toLowerCase();
    if (!query) return previewItems;
    return previewItems.filter((item) =>
      item.key.toLowerCase().includes(query),
    );
  }, [previewItems, keySearchQuery]);

  const projectSources = useMemo(
    () =>
      sources.filter(
        (s) =>
          s.projectIds.length === 0 || s.projectIds.includes(selectedProjectId),
      ),
    [sources, selectedProjectId],
  );

  const projectEnvironments = useMemo(
    () => environments.filter((e) => e.projectId === selectedProjectId),
    [environments, selectedProjectId],
  );

  function handleSelectFile(relativePath: string, fileName?: string) {
    setSelectedRelativePath(relativePath);
    setNewSourceName(
      fileName ?? (relativePath.split(/[/\\]/).pop() || relativePath),
    );
    setCustomSelectedKeys(null);
    setStepError(null);
  }

  function handleSelectProject(projectId: string) {
    setSelectedProjectIdOverride(projectId);
    setCustomSelectedKeys(null);
    setStepError(null);
  }

  async function handleBrowseFile() {
    setStepError(null);
    const selectedProject = projects.find((p) => p.id === selectedProjectId);
    try {
      const selected = await openFileDialog({
        defaultPath: selectedProject?.rootPath,
        directory: false,
        multiple: false,
        title: 'Choose an environment file',
      });
      if (typeof selected !== 'string') return;

      if (selectedProject?.rootPath) {
        const relative = toRelativeProjectPath(
          selected,
          selectedProject.rootPath,
        );
        if (relative === null) {
          setStepError(
            `The selected file must be located inside "${selectedProject.name}" (${selectedProject.rootPath}).`,
          );
          return;
        }
        handleSelectFile(relative);
      } else {
        handleSelectFile(selected);
      }
    } catch (error) {
      setStepError(
        error instanceof Error ? error.message : 'Could not open file picker.',
      );
    }
  }

  function toggleKey(key: string) {
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setCustomSelectedKeys(next);
  }

  function toggleAllKeys() {
    if (selectedKeys.size === activeItems.length) {
      setCustomSelectedKeys(new Set());
    } else {
      setCustomSelectedKeys(new Set(activeItems.map((item) => item.key)));
    }
  }

  function handleStep1Continue() {
    setStepError(null);
    if (!selectedProjectId) {
      setStepError('Please choose a project.');
      return;
    }
    if (!selectedRelativePath.trim()) {
      setStepError('Please specify or browse for an environment file.');
      return;
    }
    if (previewQuery.isError) {
      setStepError('The selected environment file could not be parsed.');
      return;
    }
    if (hasActiveDuplicates) {
      setStepError(
        'Cannot proceed: Resolve duplicate active keys in your file editor first.',
      );
      return;
    }
    if (activeItems.length === 0) {
      setStepError(
        'No active configuration keys were found to import in this file.',
      );
      return;
    }
    setCurrentStep('keys');
  }

  function handleStep2Continue() {
    setStepError(null);
    if (hasActiveDuplicates) {
      setStepError(
        'Cannot proceed: Resolve duplicate active keys in your file editor first.',
      );
      return;
    }
    if (selectedKeys.size === 0) {
      setStepError('Please select at least one active secret to import.');
      return;
    }
    setCurrentStep('destination');
  }

  async function handleFinalSubmit(event?: React.FormEvent) {
    if (event) event.preventDefault();
    setStepError(null);

    if (targetMode === 'new') {
      if (!newSourceName.trim()) {
        setStepError('Enter a name for the new vault source.');
        return;
      }
    } else if (!existingSourceId) {
      setStepError('Select an existing vault source.');
      return;
    }

    try {
      const result = await onSubmit({
        environmentId: selectedEnvironmentId || undefined,
        projectId: selectedProjectId,
        relativePath: selectedRelativePath.trim(),
        selectedKeys: Array.from(selectedKeys),
        sourceId: targetMode === 'existing' ? existingSourceId : undefined,
        sourceName: targetMode === 'new' ? newSourceName.trim() : undefined,
      });

      if (result) {
        setImportResult(result);
        setCurrentStep('complete');
      } else {
        onOpenChange(false);
      }
    } catch (error) {
      setStepError(
        error instanceof Error
          ? error.message
          : 'Failed to import environment secrets into vault.',
      );
    }
  }

  const stepNumber =
    currentStep === 'file'
      ? 1
      : currentStep === 'keys'
        ? 2
        : currentStep === 'destination'
          ? 3
          : 4;

  return (
    <DevventoryDialog isOpen={isOpen} size="3xl" onOpenChange={onOpenChange}>
      <div className="flex h-[640px] max-h-[90vh] flex-col">
        <DialogHeader
          description="Parse and securely import environment variables into Stronghold."
          icon={<IconFileCode size={ICON_SIZE.button} stroke={ICON_STROKE} />}
          title="Import Secrets from .env File"
        />

        {/* Dialog Body with Vertical Stepper Sidebar and Main Content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* LEFT SIDEBAR: Vertical Stepper & About Card */}
          <div className="flex w-60 shrink-0 flex-col justify-between border-r border-divider/60 bg-surface-secondary/20 p-4">
            {/* Stepper Navigation */}
            <nav aria-label="Import Progress" className="space-y-1">
              {/* Step 1: Select File */}
              <div
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  currentStep === 'file'
                    ? 'bg-accent/15 text-accent font-semibold'
                    : stepNumber > 1
                      ? 'cursor-pointer text-foreground hover:bg-surface-secondary/40'
                      : 'text-muted'
                }`}
                onClick={() => {
                  if (stepNumber > 1 && currentStep !== 'complete') {
                    setStepError(null);
                    setCurrentStep('file');
                  }
                }}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    currentStep === 'file'
                      ? 'border-2 border-accent bg-accent/20 text-accent font-bold'
                      : stepNumber > 1
                        ? 'bg-success/20 text-success border border-success/40'
                        : 'border border-divider bg-surface-secondary/40 text-muted'
                  }`}
                >
                  {stepNumber > 1 ? <IconCheck size={13} stroke={3} /> : '1'}
                </div>
                <span className="text-xs">Select File</span>
              </div>

              {/* Vertical connector line */}
              <div className="ml-6 h-4 w-px bg-divider/80" />

              {/* Step 2: Review Keys */}
              <div
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors ${
                  currentStep === 'keys'
                    ? 'bg-accent/15 text-accent font-semibold'
                    : stepNumber > 2
                      ? 'cursor-pointer text-foreground hover:bg-surface-secondary/40'
                      : 'text-muted'
                }`}
                onClick={() => {
                  if (
                    stepNumber > 2 &&
                    currentStep !== 'complete' &&
                    !hasActiveDuplicates
                  ) {
                    setStepError(null);
                    setCurrentStep('keys');
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      currentStep === 'keys'
                        ? 'border-2 border-accent bg-accent/20 text-accent font-bold'
                        : stepNumber > 2
                          ? 'bg-success/20 text-success border border-success/40'
                          : 'border border-divider bg-surface-secondary/40 text-muted'
                    }`}
                  >
                    {stepNumber > 2 ? <IconCheck size={13} stroke={3} /> : '2'}
                  </div>
                  <span className="text-xs">Review Keys</span>
                </div>

                {activeItems.length > 0 && (
                  <Chip
                    className="h-5 px-1.5 text-[10px] font-semibold"
                    color={currentStep === 'keys' ? 'accent' : 'default'}
                    size="sm"
                    variant="soft"
                  >
                    {activeItems.length}
                  </Chip>
                )}
              </div>

              {/* Vertical connector line */}
              <div className="ml-6 h-4 w-px bg-divider/80" />

              {/* Step 3: Destination */}
              <div
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  currentStep === 'destination'
                    ? 'bg-accent/15 text-accent font-semibold'
                    : currentStep === 'complete'
                      ? 'bg-success/20 text-success'
                      : 'text-muted'
                }`}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    currentStep === 'destination'
                      ? 'border-2 border-accent bg-accent/20 text-accent font-bold'
                      : currentStep === 'complete'
                        ? 'bg-success/20 text-success border border-success/40'
                        : 'border border-divider bg-surface-secondary/40 text-muted'
                  }`}
                >
                  {currentStep === 'complete' ? (
                    <IconCheck size={13} stroke={3} />
                  ) : (
                    '3'
                  )}
                </div>
                <span className="text-xs">Destination</span>
              </div>
            </nav>

            {/* Bottom: About Import Card */}
            <div className="rounded-lg border border-divider/60 bg-surface-secondary/30 p-3 space-y-2 text-[11px] text-muted">
              <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs pb-1 border-b border-divider/40">
                <IconInfoCircle size={14} className="text-accent" />
                <span>About Import</span>
              </div>
              <div className="flex items-start gap-2 pt-0.5">
                <IconShieldLock
                  size={13}
                  className="text-accent shrink-0 mt-0.5"
                />
                <span>Values are encrypted before storing</span>
              </div>
              <div className="flex items-start gap-2">
                <IconLock size={13} className="text-muted shrink-0 mt-0.5" />
                <span>Existing keys in source will be updated</span>
              </div>
              <div className="flex items-start gap-2">
                <IconEye size={13} className="text-success shrink-0 mt-0.5" />
                <span>You can review keys before importing</span>
              </div>
            </div>
          </div>

          {/* RIGHT MAIN CONTENT AREA */}
          <div className="flex-1 flex flex-col min-w-0 p-5 overflow-y-auto">
            {/* Inline Error Alert */}
            {stepError && (
              <div className="mb-4">
                <Alert status="danger">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>{stepError}</Alert.Description>
                  </Alert.Content>
                </Alert>
              </div>
            )}

            {/* STEP 1: SELECT FILE */}
            {currentStep === 'file' && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-accent text-xs font-bold">
                      1
                    </span>
                    <h3 className="text-sm font-semibold text-foreground">
                      Select .env File
                    </h3>
                  </div>
                  <p className="text-xs text-muted mt-0.5 ml-7">
                    Choose the .env file you want to import from your project.
                  </p>
                </div>

                {projects.length > 1 && (
                  <Select
                    fullWidth
                    onChange={(value) => {
                      if (value !== null) {
                        handleSelectProject(String(value));
                      }
                    }}
                    value={selectedProjectId || null}
                    variant="secondary"
                  >
                    <Label className="text-xs font-medium">
                      Target Project
                    </Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {projects.map((project) => (
                          <ListBox.Item
                            id={project.id}
                            key={project.id}
                            textValue={project.name}
                          >
                            <Label>{project.name}</Label>
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                )}

                {/* Environment File Input with Browse Button */}
                <div>
                  <Label className="text-xs font-medium text-foreground">
                    Environment File
                  </Label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <TextField
                      aria-label="Relative file path"
                      className="flex-1"
                      value={selectedRelativePath}
                      variant="secondary"
                      onChange={(value) => handleSelectFile(value)}
                    >
                      <Input placeholder="e.g. .env, .env.local, config/.env.production" />
                      <FieldError />
                    </TextField>

                    <Button
                      size="md"
                      variant="secondary"
                      onPress={handleBrowseFile}
                    >
                      <IconFolder size={ICON_SIZE.small} stroke={ICON_STROKE} />
                      Browse File
                    </Button>
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    Pick a file from the project directory or enter its relative
                    path.
                  </p>
                </div>

                {/* Active Duplicates Error Banner (Red) */}
                {hasActiveDuplicates && (
                  <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-danger">
                          Duplicate Active Keys Detected
                        </div>
                        <p className="text-xs text-foreground/90">
                          The environment file contains multiple active
                          definitions for the same key. The Credential Vault
                          requires unique keys per source:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-xs font-mono text-foreground">
                          {activeDuplicates.map((dup) => (
                            <li key={dup.key}>
                              <span className="font-bold text-danger">
                                {dup.key}
                              </span>{' '}
                              on lines {dup.lineNumbers.join(', ')}
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-muted">
                          Please resolve this in your file editor by either: (1)
                          commenting out duplicate lines (e.g.{' '}
                          <code># {activeDuplicates[0]?.key}=...</code>), or (2)
                          removing duplicate definitions. Once saved, click
                          Re-scan below.
                        </p>
                        <div className="pt-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onPress={() => previewQuery.refetch()}
                          >
                            <IconRefresh size={14} />
                            Re-scan File
                          </Button>
                        </div>
                      </div>
                    </Alert.Content>
                  </Alert>
                )}

                {/* Commented Keys Warning Banner (Yellow) */}
                {!hasActiveDuplicates && commentedItems.length > 0 && (
                  <Alert status="warning">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>
                        {commentedItems.length} commented-out variable
                        {commentedItems.length === 1 ? ' was' : 's were'}{' '}
                        detected (e.g. <code># KEY=value</code>). Commented
                        variables will not be stored in the Credential Vault;
                        only active variables are imported.
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                )}

                {/* Selected File Summary Card */}
                <div className="rounded-lg border border-divider bg-surface-secondary/20 p-3.5">
                  {previewQuery.isFetching ? (
                    <div className="flex items-center gap-3 py-1.5 text-xs text-muted">
                      <Spinner size="sm" />
                      <span>Parsing file and detecting environment keys…</span>
                    </div>
                  ) : previewQuery.isError ? (
                    <div className="flex items-center gap-2.5 py-1 text-xs text-danger">
                      <IconAlertTriangle size={16} />
                      <span>
                        Could not parse file. Check that the file exists and is
                        valid UTF-8 text.
                      </span>
                    </div>
                  ) : previewItems.length === 0 ? (
                    <div className="flex items-center gap-2.5 py-1 text-xs text-warning">
                      <IconAlertTriangle size={16} />
                      <span>
                        No configuration keys were detected in this file.
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                            hasActiveDuplicates
                              ? 'bg-danger/15 text-danger'
                              : 'bg-success/15 text-success'
                          }`}
                        >
                          {hasActiveDuplicates ? (
                            <IconAlertTriangle size={16} stroke={ICON_STROKE} />
                          ) : (
                            <IconCheck size={16} stroke={ICON_STROKE} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-foreground truncate">
                            {selectedRelativePath}
                          </div>
                          <div className="text-[11px] text-muted">
                            {activeItems.length} active secret
                            {activeItems.length === 1 ? '' : 's'} ready
                            {commentedItems.length > 0 &&
                              ` (${commentedItems.length} commented skipped)`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={() => previewQuery.refetch()}
                        >
                          <IconRefresh size={14} />
                        </Button>
                        <Chip
                          color={hasActiveDuplicates ? 'danger' : 'success'}
                          size="sm"
                          variant="soft"
                        >
                          {hasActiveDuplicates
                            ? 'Duplicate conflict'
                            : 'Ready to review'}
                        </Chip>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: REVIEW KEYS */}
            {currentStep === 'keys' && (
              <div className="flex flex-col h-full space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-accent text-xs font-bold">
                        2
                      </span>
                      <h3 className="text-sm font-semibold text-foreground">
                        Review Secrets ({activeItems.length})
                      </h3>
                    </div>
                    <p className="text-xs text-muted mt-0.5 ml-7">
                      Values will remain securely encrypted in Stronghold.
                    </p>
                  </div>

                  <Button size="sm" variant="ghost" onPress={toggleAllKeys}>
                    {selectedKeys.size === activeItems.length
                      ? 'Deselect All'
                      : 'Select All'}
                  </Button>
                </div>

                {/* Commented Keys Warning Banner */}
                {commentedItems.length > 0 && (
                  <Alert status="warning">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>
                        Commented variables are excluded from the vault. Only
                        active variables below will be stored.
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                )}

                {/* Search Bar */}
                <SearchField
                  aria-label="Search detected keys"
                  className="w-full"
                  value={keySearchQuery}
                  variant="secondary"
                  onChange={setKeySearchQuery}
                >
                  <Label className="sr-only">Search detected keys</Label>
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input
                      aria-label="Search detected keys"
                      className="font-mono text-xs"
                      placeholder="Filter keys by name…"
                    />
                    <SearchField.ClearButton aria-label="Clear key search" />
                  </SearchField.Group>
                </SearchField>

                {/* Keys Counter Pill */}
                <div className="flex items-center justify-between px-1 text-xs text-muted">
                  <span data-testid="active-keys-counter">
                    <strong className="text-foreground">
                      {selectedKeys.size}
                    </strong>{' '}
                    of {activeItems.length} active secrets selected
                  </span>
                  {keySearchQuery && (
                    <span>
                      Showing {filteredPreviewItems.length} of{' '}
                      {previewItems.length}
                    </span>
                  )}
                </div>

                {/* Scrollable Key List with Expanded Height */}
                <div className="flex-1 min-h-[280px] max-h-[340px] overflow-y-auto space-y-1.5 rounded-lg border border-divider bg-surface-secondary/20 p-2.5">
                  {filteredPreviewItems.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted">
                      No keys match &quot;{keySearchQuery}&quot;
                    </div>
                  ) : (
                    filteredPreviewItems.map((item) => {
                      const isDuplicate =
                        !item.isCommented &&
                        duplicateKeySet.has(item.key.toUpperCase());
                      const isChecked =
                        !item.isCommented && selectedKeys.has(item.key);

                      return (
                        <div
                          key={`${item.key}-${item.lineNumber}`}
                          className={`flex items-center justify-between rounded-md px-2.5 py-1.5 transition-colors ${
                            item.isCommented
                              ? 'bg-surface-secondary/20 border border-transparent opacity-60'
                              : isDuplicate
                                ? 'bg-danger/10 border border-danger/40'
                                : isChecked
                                  ? 'bg-accent/10 border border-accent/30 cursor-pointer'
                                  : 'bg-surface-secondary/40 border border-transparent hover:bg-surface-secondary/80 cursor-pointer'
                          }`}
                          onClick={() => {
                            if (!item.isCommented) toggleKey(item.key);
                          }}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {item.isCommented ? (
                              <Checkbox
                                aria-label={`Commented ${item.key} (Excluded)`}
                                isDisabled
                                isSelected={false}
                              />
                            ) : (
                              <Checkbox
                                aria-label={`Select ${item.key}`}
                                isSelected={isChecked}
                                onChange={() => toggleKey(item.key)}
                              />
                            )}
                            <code
                              className={`font-mono text-xs font-semibold truncate ${
                                isDuplicate
                                  ? 'text-danger'
                                  : item.isCommented
                                    ? 'text-muted line-through'
                                    : 'text-foreground'
                              }`}
                            >
                              {item.key}
                            </code>
                            <span className="text-[11px] text-muted">
                              Line {item.lineNumber}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isDuplicate && (
                              <Chip
                                className="text-[10px]"
                                color="danger"
                                size="sm"
                                variant="soft"
                              >
                                Duplicate
                              </Chip>
                            )}
                            {item.isCommented && (
                              <Chip
                                className="text-[10px]"
                                color="warning"
                                size="sm"
                                variant="soft"
                              >
                                Commented (Skipped)
                              </Chip>
                            )}
                            {item.isAlreadyInVault && (
                              <Chip
                                className="text-[10px]"
                                color="accent"
                                size="sm"
                                variant="soft"
                              >
                                In Vault
                                {item.existingSourceName
                                  ? ` (${item.existingSourceName})`
                                  : ''}
                              </Chip>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* STEP 3: DESTINATION */}
            {currentStep === 'destination' && (
              <Form className="space-y-4" onSubmit={handleFinalSubmit}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-accent text-xs font-bold">
                      3
                    </span>
                    <h3 className="text-sm font-semibold text-foreground">
                      Destination Vault Source
                    </h3>
                  </div>
                  <p className="text-xs text-muted mt-0.5 ml-7">
                    Choose where to import these {selectedKeys.size} secret
                    {selectedKeys.size === 1 ? '' : 's'}.
                  </p>
                </div>

                {/* Destination Radio Mode */}
                <div className="rounded-lg border border-divider p-4 space-y-3.5 bg-surface-secondary/15">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <input
                        checked={targetMode === 'new'}
                        name="targetMode"
                        type="radio"
                        onChange={() => setTargetMode('new')}
                      />
                      Create new vault source
                    </label>

                    {projectSources.length > 0 && (
                      <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                        <input
                          checked={targetMode === 'existing'}
                          name="targetMode"
                          type="radio"
                          onChange={() => {
                            setTargetMode('existing');
                            if (!existingSourceId && projectSources[0]) {
                              setExistingSourceId(projectSources[0].id);
                            }
                          }}
                        />
                        Add to existing source
                      </label>
                    )}
                  </div>

                  {targetMode === 'new' ? (
                    <TextField
                      aria-label="New Source Name"
                      value={newSourceName}
                      variant="secondary"
                      onChange={setNewSourceName}
                    >
                      <Label className="text-xs font-medium text-foreground">
                        Source Name
                      </Label>
                      <Input placeholder="e.g. .env.local, Staging Config" />
                    </TextField>
                  ) : (
                    <Select
                      fullWidth
                      onChange={(value) => {
                        if (value) setExistingSourceId(String(value));
                      }}
                      value={existingSourceId || null}
                      variant="secondary"
                    >
                      <Label className="text-xs font-medium text-foreground">
                        Target Source
                      </Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {projectSources.map((source) => (
                            <ListBox.Item
                              id={source.id}
                              key={source.id}
                              textValue={source.name}
                            >
                              <Label>{source.name}</Label>
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  )}

                  {/* Optional Environment Association */}
                  {projectEnvironments.length > 0 && (
                    <Select
                      fullWidth
                      onChange={(value) => {
                        setSelectedEnvironmentId(value ? String(value) : '');
                      }}
                      value={selectedEnvironmentId || null}
                      variant="secondary"
                    >
                      <Label className="text-xs font-medium text-foreground">
                        Environment Link (Optional)
                      </Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="" key="__none__" textValue="None">
                            <Label className="text-muted">None</Label>
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                          {projectEnvironments.map((env) => (
                            <ListBox.Item
                              id={env.id}
                              key={env.id}
                              textValue={env.name}
                            >
                              <Label>{env.name}</Label>
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  )}
                </div>

                {/* Import Summary Info Box */}
                <div className="flex items-center gap-3 rounded-lg border border-divider/60 bg-surface-secondary/20 p-3 text-xs text-muted">
                  <IconShieldLock
                    size={18}
                    className="text-accent flex-shrink-0"
                  />
                  <div>
                    <strong className="text-foreground">
                      {selectedKeys.size} secret
                      {selectedKeys.size === 1 ? '' : 's'}
                    </strong>{' '}
                    will be encrypted and saved into Stronghold. Existing keys
                    in this source will have their values updated.
                  </div>
                </div>
              </Form>
            )}

            {/* COMPLETION STATE */}
            {currentStep === 'complete' && importResult && (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 my-auto">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 text-success">
                  <IconShieldCheck size={36} stroke={ICON_STROKE} />
                </div>

                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    Import Complete
                  </h3>
                  <p className="mt-1 text-xs text-muted max-w-sm">
                    Environment variables were parsed and securely stored in
                    Stronghold.
                  </p>
                </div>

                <div className="flex items-center gap-4 rounded-xl border border-divider bg-surface-secondary/30 px-6 py-3.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-success text-sm">
                      {importResult.importedCount}
                    </span>{' '}
                    <span className="text-muted">imported</span>
                  </div>
                  <div className="h-4 w-px bg-divider" />
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-accent text-sm">
                      {importResult.updatedCount}
                    </span>{' '}
                    <span className="text-muted">updated</span>
                  </div>
                  <div className="h-4 w-px bg-divider" />
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-muted text-sm">0</span>{' '}
                    <span className="text-muted">failed</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Footer Actions */}
        <DialogFooter className="flex justify-between items-center border-t border-divider px-6 py-3 shrink-0">
          {currentStep === 'file' && (
            <>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                isDisabled={
                  previewQuery.isFetching ||
                  previewQuery.isError ||
                  activeItems.length === 0 ||
                  hasActiveDuplicates
                }
                size="sm"
                variant="primary"
                onPress={handleStep1Continue}
              >
                Continue
                <IconArrowRight size={14} />
              </Button>
            </>
          )}

          {currentStep === 'keys' && (
            <>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => {
                  setStepError(null);
                  setCurrentStep('file');
                }}
              >
                <IconArrowLeft size={14} />
                Back
              </Button>
              <Button
                isDisabled={selectedKeys.size === 0 || hasActiveDuplicates}
                size="sm"
                variant="primary"
                onPress={handleStep2Continue}
              >
                Continue
                <IconArrowRight size={14} />
              </Button>
            </>
          )}

          {currentStep === 'destination' && (
            <>
              <Button
                isDisabled={isSaving}
                size="sm"
                variant="secondary"
                onPress={() => {
                  setStepError(null);
                  setCurrentStep('keys');
                }}
              >
                <IconArrowLeft size={14} />
                Back
              </Button>
              <Button
                isDisabled={
                  selectedKeys.size === 0 ||
                  isSaving ||
                  (targetMode === 'new'
                    ? !newSourceName.trim()
                    : !existingSourceId)
                }
                size="sm"
                variant="primary"
                onPress={() => handleFinalSubmit()}
              >
                {isSaving ? (
                  <Spinner size="sm" />
                ) : (
                  <IconLock size={ICON_SIZE.small} />
                )}
                Import {selectedKeys.size} Secret
                {selectedKeys.size === 1 ? '' : 's'}
              </Button>
            </>
          )}

          {currentStep === 'complete' && (
            <div className="flex justify-end gap-2 w-full">
              <Button
                size="sm"
                variant="secondary"
                onPress={() => onOpenChange(false)}
              >
                Done
              </Button>
              <Button
                size="sm"
                variant="primary"
                onPress={() => onOpenChange(false)}
              >
                <IconKey size={14} />
                View Imported Keys
              </Button>
            </div>
          )}
        </DialogFooter>
      </div>
    </DevventoryDialog>
  );
}
