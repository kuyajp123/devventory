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
import type { ProjectOnboardingValues } from '../models/project';

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
                <Label>Exclusions</Label>
                <TextArea
                  {...field}
                  className="min-h-36 resize-y font-mono text-xs"
                  onChange={(event) => {
                    field.onChange(event);
                    onConfigurationChange();
                  }}
                />
                <Description>
                  One relative directory prefix per line. Glob patterns are not
                  used.
                </Description>
                <FieldError>{fieldState.error?.message}</FieldError>
              </TextField>
            )}
          />
        </div>
      </Fieldset.Group>
    </Fieldset>
  );
}
