import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import {
  Button,
  Checkbox,
  CheckboxGroup,
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
import { IconDatabase, IconPhoto } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import type { Project } from '@/features/projects';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  DevventoryDialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '@/shared/ui';
import {
  credentialSourceNameSchema,
  PREDEFINED_CREDENTIAL_SOURCES,
  type CredentialSource,
} from '../models/credential-vault';

const CUSTOM_DEFINITION = 'custom';

export interface CredentialSourceValues {
  definitionKey?: string;
  description?: string;
  iconSourcePath?: string;
  name: string;
  projectIds: string[];
  removeIcon?: boolean;
}

export function CredentialSourceDialog({
  isOpen,
  isSaving,
  onOpenChange,
  onSubmit,
  projects,
  source,
}: {
  isOpen: boolean;
  isSaving: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (values: CredentialSourceValues) => Promise<void>;
  projects: Project[];
  source: CredentialSource | null;
}) {
  const [definitionKey, setDefinitionKey] = useState(
    source?.definitionKey ?? CUSTOM_DEFINITION,
  );
  const [description, setDescription] = useState(source?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [iconSourcePath, setIconSourcePath] = useState<string | null>(null);
  const [name, setName] = useState(source?.name ?? '');
  const [projectIds, setProjectIds] = useState<string[]>(
    source?.projectIds ?? [],
  );
  const [removeIcon, setRemoveIcon] = useState(false);
  const selectedDefinition = useMemo(
    () =>
      PREDEFINED_CREDENTIAL_SOURCES.find(
        (item) => item.key === definitionKey,
      ) ?? null,
    [definitionKey],
  );

  function changeDefinition(value: React.Key | null) {
    if (value === null || source) return;
    const nextKey = String(value);
    setDefinitionKey(nextKey);
    const definition = PREDEFINED_CREDENTIAL_SOURCES.find(
      (item) => item.key === nextKey,
    );
    if (definition) {
      setName(definition.defaultName);
      setDescription(definition.description);
    } else {
      setName('');
      setDescription('');
    }
  }

  async function chooseIcon() {
    const selected = await openFileDialog({
      directory: false,
      filters: [{ extensions: ['png', 'jpg', 'jpeg', 'webp'], name: 'Images' }],
      multiple: false,
      title: 'Choose credential source icon',
    });
    if (typeof selected === 'string') {
      setIconSourcePath(selected);
      setRemoveIcon(false);
    }
  }

  async function submit() {
    const parsed = credentialSourceNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid source name.');
      return;
    }
    setError(null);

    const baseValues = {
      ...(definitionKey !== CUSTOM_DEFINITION ? { definitionKey } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(iconSourcePath ? { iconSourcePath } : {}),
      name: parsed.data,
      projectIds,
    };

    // Only include removeIcon when updating an existing source
    await onSubmit(source ? { ...baseValues, removeIcon } : baseValues);
  }

  const isCustom = definitionKey === CUSTOM_DEFINITION;

  return (
    <DevventoryDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      scroll
      size="lg"
    >
      <DialogHeader
        icon={<IconDatabase size={ICON_SIZE.button} stroke={ICON_STROKE} />}
        title={source ? 'Edit credential source' : 'Create credential source'}
      />
      <DialogBody>
        <Form
          className="space-y-4"
          onSubmit={(event) => event.preventDefault()}
          validationBehavior="aria"
        >
          <Select
            fullWidth
            isDisabled={Boolean(source) || isSaving}
            onChange={changeDefinition}
            value={definitionKey}
            variant="secondary"
          >
            <Label>Source type</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id={CUSTOM_DEFINITION} textValue="Custom source">
                  <Label>Custom source</Label>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                {PREDEFINED_CREDENTIAL_SOURCES.map((definition) => (
                  <ListBox.Item
                    id={definition.key}
                    key={definition.key}
                    textValue={definition.defaultName}
                  >
                    <Label>{definition.defaultName}</Label>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <TextField fullWidth isInvalid={Boolean(error)} variant="secondary">
            <Label>Source instance name</Label>
            <Input
              autoFocus
              disabled={isSaving}
              onChange={(event) => setName(event.target.value)}
              placeholder={
                selectedDefinition
                  ? `${selectedDefinition.defaultName} Work`
                  : 'Release credentials'
              }
              value={name}
            />
            <p className="text-xs text-muted">
              Use instance names such as AWS Personal, AWS Work, or Client A.
            </p>
            <FieldError>{error}</FieldError>
          </TextField>

          <TextField fullWidth variant="secondary">
            <Label>Description (optional)</Label>
            <TextArea
              disabled={isSaving}
              maxLength={2000}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What this source is used for"
              rows={3}
              value={description}
            />
          </TextField>

          {isCustom ? (
            <div className="rounded-md border border-divider bg-workspace p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Custom icon
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Optional PNG, JPEG, or WebP up to 2 MB. Devventory copies it
                    into local app data.
                  </p>
                </div>
                <Button
                  isDisabled={isSaving}
                  onPress={() => void chooseIcon()}
                  size="sm"
                  variant="secondary"
                >
                  <IconPhoto size={ICON_SIZE.small} stroke={ICON_STROKE} />
                  Choose image
                </Button>
              </div>
              {iconSourcePath ? (
                <p
                  className="mt-2 truncate font-mono text-[11px] text-muted"
                  title={iconSourcePath}
                >
                  {iconSourcePath}
                </p>
              ) : null}
              {source?.iconPath && !iconSourcePath ? (
                <Checkbox isSelected={removeIcon} onChange={setRemoveIcon}>
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Label>Remove the current custom icon</Label>
                  </Checkbox.Content>
                </Checkbox>
              ) : null}
            </div>
          ) : (
            <p className="rounded-md border border-divider bg-workspace p-3 text-xs text-muted">
              The predefined logo is resolved from{' '}
              <span className="font-mono text-foreground">
                src/assets/sources/
              </span>
              . A generic source mark is used until its PNG is added.
            </p>
          )}

          <CheckboxGroup onChange={setProjectIds} value={projectIds}>
            <Label>Broad project association</Label>
            <p className="text-xs text-muted">
              This describes where the source is generally used. Each credential
              can define a more specific project and environment scope.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {projects.map((project) => (
                <Checkbox key={project.id} value={project.id}>
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Label>{project.name}</Label>
                  </Checkbox.Content>
                </Checkbox>
              ))}
            </div>
          </CheckboxGroup>
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
          isDisabled={isSaving}
          onPress={() => void submit()}
          size="sm"
          variant="primary"
        >
          {isSaving ? <Spinner aria-label="Saving source" size="sm" /> : null}
          {source ? 'Save source' : 'Create source'}
        </Button>
      </DialogFooter>
    </DevventoryDialog>
  );
}
