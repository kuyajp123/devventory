import {
  Button,
  Description,
  FieldError,
  Fieldset,
  Input,
  Label,
  TextArea,
  TextField,
} from '@heroui/react';
import { IconFolderOpen } from '@tabler/icons-react';
import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from 'react-hook-form';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  DEFAULT_PROJECT_EXCLUSIONS,
  type ProjectOnboardingValues,
} from '../models/project';

interface ProjectFolderFieldsProps {
  control: Control<ProjectOnboardingValues>;
  errors: FieldErrors<ProjectOnboardingValues>;
  isDisabled: boolean;
  onChooseFolder: () => void;
  onConfigurationChange: () => void;
  register: UseFormRegister<ProjectOnboardingValues>;
  rootPath: string;
  rootValidated: boolean;
}

export function ProjectFolderFields({
  control,
  errors,
  isDisabled,
  onChooseFolder,
  onConfigurationChange,
  register,
  rootPath,
  rootValidated,
}: ProjectFolderFieldsProps) {
  return (
    <Fieldset disabled={isDisabled}>
      <Fieldset.Legend>Local folders</Fieldset.Legend>
      <Fieldset.Group className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextField
            className="min-w-0 flex-1"
            fullWidth
            isInvalid={Boolean(errors.rootPath)}
            variant="secondary"
          >
            <Label>Selected project root</Label>
            <Input
              className="font-mono text-xs"
              placeholder="No folder selected"
              readOnly
              {...register('rootPath')}
              value={rootPath}
            />
            {rootValidated && (
              <Description className="font-medium text-success">
                Folder validated
              </Description>
            )}
            <FieldError>{errors.rootPath?.message}</FieldError>
          </TextField>
          <Button onPress={onChooseFolder} type="button" variant="secondary">
            <IconFolderOpen
              aria-hidden="true"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
            Choose folder
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Controller
            control={control}
            name="watchedLocationsText"
            render={({ field, fieldState }) => (
              <TextField
                fullWidth
                isInvalid={Boolean(fieldState.error)}
                variant="secondary"
              >
                <Label>Watched locations</Label>
                <TextArea
                  {...field}
                  className="min-h-36 resize-y font-mono text-xs"
                  onChange={(event) => {
                    field.onChange(event);
                    onConfigurationChange();
                  }}
                />
                <Description>
                  One relative folder per line. Use <code>.</code> for the
                  project root.
                </Description>
                <FieldError>{fieldState.error?.message}</FieldError>
              </TextField>
            )}
          />

          <Controller
            control={control}
            name="exclusionsText"
            render={({ field, fieldState }) => (
              <TextField
                fullWidth
                isInvalid={Boolean(fieldState.error)}
                variant="secondary"
              >
                <Label>Additional exclusions</Label>
                <TextArea
                  {...field}
                  className="min-h-36 resize-y font-mono text-xs"
                  onChange={(event) => {
                    field.onChange(event);
                    onConfigurationChange();
                  }}
                />
                <Description>
                  Optional project-relative directory prefixes, one per line.
                  You can add or remove these at any time during onboarding.
                </Description>
                <FieldError>{fieldState.error?.message}</FieldError>
              </TextField>
            )}
          />
        </div>

        <section
          aria-labelledby="built-in-exclusions-title"
          className="rounded-md border border-divider bg-workspace p-3"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3
              className="text-sm font-medium text-foreground"
              id="built-in-exclusions-title"
            >
              Built-in exclusions
            </h3>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Managed by Devventory
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            These technical directories are always excluded from scans and the
            Project Tree. They cannot be edited or removed.
          </p>
          <ul
            className="mt-3 flex flex-wrap gap-1.5"
            aria-label="Built-in exclusions"
          >
            {DEFAULT_PROJECT_EXCLUSIONS.map((exclusion) => (
              <li
                className="rounded border border-divider bg-panel px-2 py-1 font-mono text-[11px] text-secondary"
                key={exclusion}
              >
                {exclusion}
              </li>
            ))}
          </ul>
        </section>
      </Fieldset.Group>
    </Fieldset>
  );
}
