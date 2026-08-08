import { zodResolver } from '@hookform/resolvers/zod';
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
  Switch,
  TextArea,
  TextField,
} from '@heroui/react';
import { IconBraces } from '@tabler/icons-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { Environment } from '@/features/environment-tracker';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  DevventoryDialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '@/shared/ui';
import {
  validationRuleFormSchema,
  type ValidationRule,
  type ValidationRuleFormValues,
} from '../models/validation';

interface ValidationRuleFormModalProps {
  environments: Environment[];
  isOpen: boolean;
  isSaving: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (values: ValidationRuleFormValues) => Promise<void>;
  rule: ValidationRule | null;
}

export function ValidationRuleFormModal({
  environments,
  isOpen,
  isSaving,
  onOpenChange,
  onSubmit,
  rule,
}: ValidationRuleFormModalProps) {
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<ValidationRuleFormValues>({
    defaultValues: formDefaults(rule),
    resolver: zodResolver(validationRuleFormSchema),
  });

  useEffect(() => reset(formDefaults(rule)), [reset, rule]);

  const submit = handleSubmit(async (values) => {
    await onSubmit({
      ...values,
      description: values.description.trim(),
      keyName: values.keyName.trim(),
    });
  });

  return (
    <DevventoryDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="lg"
      scroll
    >
      <DialogHeader
        icon={
          <IconBraces
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
        }
        title={rule ? 'Edit validation rule' : 'Create validation rule'}
      />
      <DialogBody>
        <Form
          className="space-y-4"
          onSubmit={(event) => event.preventDefault()}
          validationBehavior="aria"
        >
          <TextField
            fullWidth
            isInvalid={Boolean(errors.keyName)}
            variant="secondary"
          >
            <Label>Environment key</Label>
            <Input
              autoFocus
              disabled={isSaving}
              placeholder="DATABASE_URL"
              {...register('keyName')}
            />
            <FieldError>{errors.keyName?.message}</FieldError>
          </TextField>

          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="ruleType"
              render={({ field }) => (
                <Select
                  fullWidth
                  isDisabled={isSaving}
                  onChange={(value) => field.onChange(value)}
                  value={field.value}
                  variant="secondary"
                >
                  <Label>Rule type</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {['required', 'optional', 'forbidden'].map((value) => (
                        <ListBox.Item
                          id={value}
                          key={value}
                          textValue={capitalize(value)}
                        >
                          <Label>{capitalize(value)}</Label>
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              )}
            />
            <Controller
              control={control}
              name="severity"
              render={({ field }) => (
                <Select
                  fullWidth
                  isDisabled={isSaving}
                  onChange={(value) => field.onChange(value)}
                  value={field.value}
                  variant="secondary"
                >
                  <Label>Severity</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {['error', 'warning', 'info'].map((value) => (
                        <ListBox.Item
                          id={value}
                          key={value}
                          textValue={capitalize(value)}
                        >
                          <Label>{capitalize(value)}</Label>
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              )}
            />
          </div>

          <Controller
            control={control}
            name="environmentIds"
            render={({ field }) => (
              <CheckboxGroup
                className="rounded-md border border-divider bg-workspace p-3"
                isDisabled={isSaving}
                isInvalid={Boolean(errors.environmentIds)}
                onChange={field.onChange}
                value={field.value}
              >
                <Label>Target environments</Label>
                <p className="mb-2 text-xs text-muted">
                  The rule applies only to the environments selected here.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {environments.map((environment) => (
                    <Checkbox key={environment.id} value={environment.id}>
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <Label>{environment.name}</Label>
                      </Checkbox.Content>
                    </Checkbox>
                  ))}
                </div>
                <FieldError>{errors.environmentIds?.message}</FieldError>
              </CheckboxGroup>
            )}
          />

          <TextField
            fullWidth
            isInvalid={Boolean(errors.description)}
            variant="secondary"
          >
            <Label>Description (optional)</Label>
            <TextArea
              disabled={isSaving}
              placeholder="Why this key is required or restricted"
              rows={3}
              {...register('description')}
            />
            <FieldError>{errors.description?.message}</FieldError>
          </TextField>

          <Controller
            control={control}
            name="enabled"
            render={({ field }) => (
              <Switch isSelected={field.value} onChange={field.onChange}>
                <Switch.Content>
                  <span>
                    <span className="block text-sm font-medium">
                      Rule enabled
                    </span>
                    <span className="block text-xs text-muted">
                      Disabled rules remain saved but do not create issues.
                    </span>
                  </span>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            )}
          />
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
          {isSaving && (
            <Spinner aria-label="Saving validation rule" size="sm" />
          )}
          {rule ? 'Save rule' : 'Create rule'}
        </Button>
      </DialogFooter>
    </DevventoryDialog>
  );
}

function formDefaults(rule: ValidationRule | null): ValidationRuleFormValues {
  return {
    description: rule?.description ?? '',
    enabled: rule?.enabled ?? true,
    environmentIds: rule?.environmentIds ?? [],
    keyName: rule?.keyName ?? '',
    ruleType: rule?.ruleType ?? 'required',
    severity: rule?.severity ?? 'error',
  };
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
