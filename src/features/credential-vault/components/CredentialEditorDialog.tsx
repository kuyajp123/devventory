import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  TextArea,
  TextField,
} from '@heroui/react';
import { IconKey, IconPlus, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import type { Project } from '@/features/projects';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  DevventoryDialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  preserveExactTextareaPaste,
} from '@/shared/ui';
import {
  credentialKeySchema,
  MAX_CREDENTIAL_VALUE_BYTES,
  type Credential,
  type CredentialDraft,
  type CredentialEnvironmentLink,
  type CredentialSource,
} from '../models/credential-vault';
import { ProjectCredentialAssociations } from './ProjectCredentialAssociations';

interface DraftState {
  environmentLinks: CredentialEnvironmentLink[];
  id: string;
  key: string;
  notes: string;
  projectIds: string[];
  value: string;
}

export function CredentialEditorDialog({
  credential,
  initialSourceId,
  isOpen,
  isSaving,
  onCreate,
  onOpenChange,
  onUpdate,
  projects,
  sources,
}: {
  credential: Credential | null;
  initialSourceId: string | null;
  isOpen: boolean;
  isSaving: boolean;
  onCreate: (sourceId: string, credentials: CredentialDraft[]) => Promise<void>;
  onOpenChange: (isOpen: boolean) => void;
  onUpdate: (input: {
    credentialId: string;
    environmentLinks: CredentialEnvironmentLink[];
    key: string;
    notes?: string;
    projectIds: string[];
  }) => Promise<void>;
  projects: Project[];
  sources: CredentialSource[];
}) {
  const [drafts, setDrafts] = useState<DraftState[]>(() =>
    credential ? [credentialDraftState(credential)] : [emptyDraft()],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sourceId, setSourceId] = useState(
    () => credential?.sourceId ?? initialSourceId ?? sources[0]?.id ?? '',
  );

  const source = sources.find((item) => item.id === sourceId) ?? null;
  const isEditing = credential !== null;

  function updateDraft(id: string, patch: Partial<DraftState>) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === id ? { ...draft, ...patch } : draft,
      ),
    );
  }

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};
    const normalized = new Set<string>();
    if (!sourceId) nextErrors.source = 'Choose a credential source.';
    for (const draft of drafts) {
      const parsed = credentialKeySchema.safeParse(draft.key);
      if (!parsed.success) {
        nextErrors[draft.id] =
          parsed.error.issues[0]?.message ?? 'Enter a valid credential key.';
      } else if (!normalized.add(parsed.data.toUpperCase())) {
        nextErrors[draft.id] =
          'Credential keys must be unique within this source.';
      }
      if (
        new TextEncoder().encode(draft.value).length >
        MAX_CREDENTIAL_VALUE_BYTES
      ) {
        nextErrors[`${draft.id}:value`] = 'Use a value no larger than 1 MB.';
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    if (isEditing) {
      const draft = drafts[0];
      await onUpdate({
        credentialId: credential.id,
        environmentLinks: draft.environmentLinks,
        key: draft.key.trim(),
        ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
        projectIds: draft.projectIds,
      });
    } else {
      await onCreate(
        sourceId,
        drafts.map((draft) => ({
          environmentLinks: draft.environmentLinks,
          key: draft.key.trim(),
          ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
          projectIds: draft.projectIds,
          ...(draft.value.length > 0 ? { value: draft.value } : {}),
        })),
      );
    }
  }

  return (
    <DevventoryDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      scroll
      size="2xl"
    >
      <DialogHeader
        icon={<IconKey size={ICON_SIZE.button} stroke={ICON_STROKE} />}
        title={isEditing ? 'Edit credential' : 'Create credentials'}
      />
      <DialogBody>
        <Form
          className="space-y-4"
          onSubmit={(event) => event.preventDefault()}
          validationBehavior="aria"
        >
          <Select
            fullWidth
            isDisabled={isEditing || isSaving}
            isInvalid={Boolean(errors.source)}
            onChange={(value) => value !== null && setSourceId(String(value))}
            value={sourceId || null}
            variant="secondary"
          >
            <Label>Credential source</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {sources.map((item) => (
                  <ListBox.Item
                    id={item.id}
                    key={item.id}
                    textValue={item.name}
                  >
                    <Label>{item.name}</Label>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
            <FieldError>{errors.source}</FieldError>
          </Select>

          {drafts.map((draft, index) => (
            <section
              aria-labelledby={`credential-draft-${draft.id}`}
              className="rounded-md border border-divider bg-surface-secondary/30 p-4"
              key={draft.id}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3
                    className="font-mono text-sm font-semibold text-foreground"
                    id={`credential-draft-${draft.id}`}
                  >
                    Credential {index + 1}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    {source
                      ? `Stored under ${source.name}`
                      : 'Choose a source above'}
                  </p>
                </div>
                {!isEditing && drafts.length > 1 ? (
                  <Button
                    aria-label={`Remove credential ${index + 1}`}
                    isIconOnly
                    onPress={() =>
                      setDrafts((current) =>
                        current.filter((item) => item.id !== draft.id),
                      )
                    }
                    size="sm"
                    variant="ghost"
                  >
                    <IconTrash size={ICON_SIZE.small} stroke={ICON_STROKE} />
                  </Button>
                ) : null}
              </div>

              <div
                className={`grid gap-4 ${isEditing ? '' : 'lg:grid-cols-2'}`}
              >
                <TextField
                  fullWidth
                  isInvalid={Boolean(errors[draft.id])}
                  variant="secondary"
                >
                  <Label>Key</Label>
                  <Input
                    autoFocus={index === 0}
                    disabled={isSaving}
                    maxLength={255}
                    onChange={(event) =>
                      updateDraft(draft.id, { key: event.target.value })
                    }
                    placeholder="TAURI_SIGNING_PRIVATE_KEY"
                    value={draft.key}
                  />
                  <FieldError>{errors[draft.id]}</FieldError>
                </TextField>
                {!isEditing ? (
                  <TextField
                    fullWidth
                    isInvalid={Boolean(errors[`${draft.id}:value`])}
                    variant="secondary"
                  >
                    <Label>Value (optional)</Label>
                    <TextArea
                      className="font-mono text-xs"
                      disabled={isSaving}
                      onChange={(event) =>
                        updateDraft(draft.id, { value: event.target.value })
                      }
                      onPaste={(event) =>
                        preserveExactTextareaPaste(
                          event,
                          draft.value,
                          (value) => updateDraft(draft.id, { value }),
                        )
                      }
                      placeholder="Paste the exact token, JSON, PEM, or multiline value"
                      rows={5}
                      value={draft.value}
                    />
                    <p className="text-xs text-muted">
                      Preserved exactly and encrypted before storage. Blank
                      means metadata-only.
                    </p>
                    <FieldError>{errors[`${draft.id}:value`]}</FieldError>
                  </TextField>
                ) : null}
              </div>

              <TextField className="mt-4" fullWidth variant="secondary">
                <Label>Notes (optional)</Label>
                <TextArea
                  disabled={isSaving}
                  maxLength={2000}
                  onChange={(event) =>
                    updateDraft(draft.id, { notes: event.target.value })
                  }
                  placeholder="Purpose, rotation context, or safe usage notes"
                  rows={2}
                  value={draft.notes}
                />
              </TextField>

              <div className="mt-4">
                <ProjectCredentialAssociations
                  environmentLinks={draft.environmentLinks}
                  onChange={(value) => updateDraft(draft.id, value)}
                  projectIds={draft.projectIds}
                  projects={projects}
                />
              </div>
            </section>
          ))}

          {!isEditing ? (
            <Button
              isDisabled={isSaving || drafts.length >= 50}
              onPress={() => setDrafts((current) => [...current, emptyDraft()])}
              variant="secondary"
            >
              <IconPlus size={ICON_SIZE.small} stroke={ICON_STROKE} />
              Add another credential
            </Button>
          ) : null}
        </Form>
      </DialogBody>
      <DialogFooter>
        <Button
          isDisabled={isSaving}
          onPress={() => onOpenChange(false)}
          size="sm"
          variant="secondary"
        >
          Cancel
        </Button>
        <Button
          isDisabled={isSaving || sources.length === 0}
          onPress={() => void submit()}
          size="sm"
          variant="primary"
        >
          {isSaving ? (
            <Spinner aria-label="Saving credentials" size="sm" />
          ) : null}
          {isEditing
            ? 'Save credential'
            : drafts.length === 1
              ? 'Create credential'
              : `Create ${drafts.length} credentials`}
        </Button>
      </DialogFooter>
    </DevventoryDialog>
  );
}

function emptyDraft(): DraftState {
  return {
    environmentLinks: [],
    id: crypto.randomUUID(),
    key: '',
    notes: '',
    projectIds: [],
    value: '',
  };
}

function credentialDraftState(credential: Credential): DraftState {
  return {
    environmentLinks: credential.environmentLinks,
    id: credential.id,
    key: credential.key,
    notes: credential.notes ?? '',
    projectIds: credential.projectIds,
    value: '',
  };
}
