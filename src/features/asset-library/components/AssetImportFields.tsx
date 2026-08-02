import {
  Description,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  Switch,
  TextArea,
  TextField,
} from '@heroui/react';
import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from 'react-hook-form';
import type { AssetImportFormValues, CollisionChoice } from '../models/asset';

interface AssetImportFieldsProps {
  control: Control<AssetImportFormValues>;
  errors: FieldErrors<AssetImportFormValues>;
  isDisabled: boolean;
  register: UseFormRegister<AssetImportFormValues>;
  watchedLocations: string[];
}

const collisionOptions: ReadonlyArray<{
  description: string;
  label: string;
  value: CollisionChoice;
}> = [
  {
    description: 'Make no changes if the name exists.',
    label: 'Cancel',
    value: 'cancel',
  },
  {
    description: 'Replace the existing destination safely.',
    label: 'Replace',
    value: 'replace',
  },
  {
    description: 'Generate file (1).ext deterministically.',
    label: 'Keep both',
    value: 'keep_both',
  },
  {
    description: 'Require the custom filename below.',
    label: 'Rename',
    value: 'rename',
  },
];

export function AssetImportFields({
  control,
  errors,
  isDisabled,
  register,
  watchedLocations,
}: AssetImportFieldsProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField
        fullWidth
        isInvalid={Boolean(errors.destination)}
        variant="secondary"
      >
        <Label>Destination directory (project-relative)</Label>
        <Input
          disabled={isDisabled}
          placeholder="assets/icons"
          {...register('destination')}
        />
        <Description>
          Must stay under: {watchedLocations.join(', ')}
        </Description>
        <FieldError>{errors.destination?.message}</FieldError>
      </TextField>

      <Controller
        control={control}
        name="collision"
        render={({ field, fieldState }) => (
          <Select
            fullWidth
            isDisabled={isDisabled}
            isInvalid={Boolean(fieldState.error)}
            onBlur={field.onBlur}
            onChange={(value) =>
              value !== null && field.onChange(String(value) as CollisionChoice)
            }
            value={field.value}
            variant="secondary"
          >
            <Label>If the filename exists</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <FieldError>{fieldState.error?.message}</FieldError>
            <Select.Popover>
              <ListBox>
                {collisionOptions.map((option) => (
                  <ListBox.Item
                    id={option.value}
                    key={option.value}
                    textValue={option.label}
                  >
                    <Label>{option.label}</Label>
                    <span className="block text-xs text-muted">
                      {option.description}
                    </span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        )}
      />

      <TextField
        fullWidth
        isInvalid={Boolean(errors.filename)}
        variant="secondary"
      >
        <Label>Destination filename (optional)</Label>
        <Input
          disabled={isDisabled}
          placeholder="logo-final.png"
          {...register('filename')}
        />
        <FieldError>{errors.filename?.message}</FieldError>
      </TextField>

      <TextField
        fullWidth
        isInvalid={Boolean(errors.tagsText)}
        variant="secondary"
      >
        <Label>Tags (comma separated)</Label>
        <Input
          disabled={isDisabled}
          placeholder="brand, approved"
          {...register('tagsText')}
        />
        <FieldError>{errors.tagsText?.message}</FieldError>
      </TextField>

      <TextField
        className="sm:col-span-2"
        fullWidth
        isInvalid={Boolean(errors.note)}
        variant="secondary"
      >
        <Label>Note (optional)</Label>
        <TextArea disabled={isDisabled} rows={3} {...register('note')} />
        <FieldError>{errors.note?.message}</FieldError>
      </TextField>

      <Controller
        control={control}
        name="favorite"
        render={({ field }) => (
          <Switch
            isDisabled={isDisabled}
            isSelected={field.value}
            onChange={field.onChange}
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              Add to favorites
            </Switch.Content>
          </Switch>
        )}
      />
    </div>
  );
}
