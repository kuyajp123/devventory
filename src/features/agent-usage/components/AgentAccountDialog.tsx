import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  TextField,
} from '@heroui/react';
import { IconRobot } from '@tabler/icons-react';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  DevventoryDialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '@/shared/ui';
import {
  agentAccountFormSchema,
  DEFAULT_TIMEZONE,
  PLATFORM_LABELS,
  SIGN_IN_METHOD_LABELS,
  TIMEZONE_OPTIONS,
  type AgentAccount,
  type AgentAccountFormValues,
  type AgentPlatform,
} from '../models/agent-usage';

interface AgentAccountDialogProps {
  account: AgentAccount | null;
  initialPlatform?: {
    customPlatform: string | null;
    platform: AgentPlatform;
  } | null;
  isOpen: boolean;
  isSaving: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (values: AgentAccountFormValues) => Promise<void>;
}

export function AgentAccountDialog({
  account,
  initialPlatform,
  isOpen,
  isSaving,
  onOpenChange,
  onSubmit,
}: AgentAccountDialogProps) {
  const {
    control,
    formState: { errors },
    handleSubmit,
    reset,
  } = useForm<AgentAccountFormValues>({
    defaultValues: defaults(account, initialPlatform),
    values: defaults(account, initialPlatform),
    resolver: zodResolver(agentAccountFormSchema),
  });
  const platform = useWatch({ control, name: 'platform' });

  useEffect(() => {
    if (isOpen) {
      reset(defaults(account, initialPlatform));
    }
  }, [account, initialPlatform, isOpen, reset]);

  const submit = handleSubmit(async (values) => {
    await onSubmit({
      ...values,
      customPlatform: values.customPlatform.trim(),
      identifier: values.identifier.trim(),
    });
  });

  return (
    <DevventoryDialog isOpen={isOpen} onOpenChange={onOpenChange} size="lg">
      <DialogHeader
        icon={
          <IconRobot
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
        }
        title={
          account ? 'Edit coding-agent account' : 'Add coding-agent account'
        }
      />
      <DialogBody>
        <Form
          className="space-y-4"
          onSubmit={(event) => event.preventDefault()}
          validationBehavior="aria"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="platform"
              render={({ field }) => (
                <Select
                  fullWidth
                  isDisabled={isSaving}
                  onChange={field.onChange}
                  value={field.value}
                  variant="secondary"
                >
                  <Label>Coding-agent platform</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
                        <ListBox.Item id={value} key={value} textValue={label}>
                          <Label>{label}</Label>
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
              name="signInMethod"
              render={({ field }) => (
                <Select
                  fullWidth
                  isDisabled={isSaving}
                  onChange={field.onChange}
                  value={field.value}
                  variant="secondary"
                >
                  <Label>Sign-in method</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {Object.entries(SIGN_IN_METHOD_LABELS).map(
                        ([value, label]) => (
                          <ListBox.Item
                            id={value}
                            key={value}
                            textValue={label}
                          >
                            <Label>{label}</Label>
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ),
                      )}
                    </ListBox>
                  </Select.Popover>
                </Select>
              )}
            />
          </div>

          {platform === 'custom' && (
            <Controller
              control={control}
              name="customPlatform"
              render={({ field }) => (
                <TextField
                  fullWidth
                  isInvalid={Boolean(errors.customPlatform)}
                  variant="secondary"
                >
                  <Label>Custom platform name</Label>
                  <Input
                    disabled={isSaving}
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    placeholder="OpenCode"
                    value={field.value}
                  />
                  <FieldError>{errors.customPlatform?.message}</FieldError>
                </TextField>
              )}
            />
          )}

          <Controller
            control={control}
            name="identifier"
            render={({ field }) => (
              <TextField
                fullWidth
                isInvalid={Boolean(errors.identifier)}
                variant="secondary"
              >
                <Label>Full account identifier</Label>
                <Input
                  autoFocus
                  disabled={isSaving}
                  name={field.name}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  placeholder="developer@example.com"
                  value={field.value}
                />
                <p className="text-xs text-muted">
                  Use the email, username, phone number, or organization
                  identifier shown by the provider. Devventory displays it in
                  full.
                </p>
                <FieldError>{errors.identifier?.message}</FieldError>
              </TextField>
            )}
          />

          <Controller
            control={control}
            name="defaultTimezone"
            render={({ field }) => (
              <Select
                fullWidth
                isDisabled={isSaving}
                onChange={field.onChange}
                value={field.value}
                variant="secondary"
              >
                <Label>Default timezone</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {TIMEZONE_OPTIONS.map((timezone) => (
                      <ListBox.Item
                        id={timezone}
                        key={timezone}
                        textValue={timezone}
                      >
                        <Label>{timezone}</Label>
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            )}
          />

          <Alert status="default">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Manual tracking</Alert.Title>
              <Alert.Description>
                No provider credentials are requested or stored. Automatic
                connectors remain unavailable until a stable official interface
                is verified.
              </Alert.Description>
            </Alert.Content>
          </Alert>
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
          {isSaving && <Spinner aria-label="Saving account" size="sm" />}
          Save account
        </Button>
      </DialogFooter>
    </DevventoryDialog>
  );
}

function defaults(
  account: AgentAccount | null,
  initialPlatform?: {
    customPlatform: string | null;
    platform: AgentPlatform;
  } | null,
): AgentAccountFormValues {
  return {
    customPlatform:
      account?.customPlatform ?? initialPlatform?.customPlatform ?? '',
    defaultTimezone: account?.defaultTimezone ?? DEFAULT_TIMEZONE,
    identifier: account?.identifier ?? '',
    platform: account?.platform ?? initialPlatform?.platform ?? 'codex',
    signInMethod: account?.signInMethod ?? 'google',
    trackingMode: 'manual',
  };
}
