import {
  FieldError,
  Fieldset,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from '@heroui/react';
import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from 'react-hook-form';
import {
  projectTypeOptions,
  type ProjectOnboardingValues,
  type ProjectType,
} from '../models/project';

interface ProjectDetailsFieldsProps {
  control: Control<ProjectOnboardingValues>;
  errors: FieldErrors<ProjectOnboardingValues>;
  isDisabled: boolean;
  register: UseFormRegister<ProjectOnboardingValues>;
}

export function ProjectDetailsFields({
  control,
  errors,
  isDisabled,
  register,
}: ProjectDetailsFieldsProps) {
  return (
    <Fieldset disabled={isDisabled}>
      <Fieldset.Legend>Project details</Fieldset.Legend>
      <Fieldset.Group className="grid gap-5 sm:grid-cols-2">
        <TextField
          fullWidth
          isInvalid={Boolean(errors.name)}
          variant="secondary"
        >
          <Label>Project name</Label>
          <Input {...register('name')} />
          <FieldError>{errors.name?.message}</FieldError>
        </TextField>

        <Controller
          control={control}
          name="projectType"
          render={({ field, fieldState }) => (
            <Select
              fullWidth
              isInvalid={Boolean(fieldState.error)}
              name={field.name}
              onBlur={field.onBlur}
              onChange={(value) => {
                if (value !== null)
                  field.onChange(String(value) as ProjectType);
              }}
              ref={field.ref}
              value={field.value}
              variant="secondary"
            >
              <Label>Project type</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <FieldError>{fieldState.error?.message}</FieldError>
              <Select.Popover>
                <ListBox>
                  {projectTypeOptions.map((option) => (
                    <ListBox.Item
                      id={option.value}
                      key={option.value}
                      textValue={option.label}
                    >
                      <Label>{option.label}</Label>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          )}
        />

        <TextField
          className="sm:col-span-2"
          fullWidth
          isInvalid={Boolean(errors.description)}
          variant="secondary"
        >
          <Label>Description (optional)</Label>
          <TextArea rows={4} {...register('description')} />
          <FieldError>{errors.description?.message}</FieldError>
        </TextField>
      </Fieldset.Group>
    </Fieldset>
  );
}
