import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Checkbox,
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
import { IconClock } from '@tabler/icons-react';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  DevventoryDialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '@/shared/ui';
import { usePreviewAgentResetMutation } from '../hooks/use-agent-usage';
import {
  agentQuotaFormSchema,
  DEFAULT_TIMEZONE,
  TIMEZONE_OPTIONS,
  type AgentAccount,
  type AgentQuota,
  type AgentQuotaFormValues,
  type ResetPreview,
  type SaveAgentQuotaInput,
} from '../models/agent-usage';

type ResetMode = 'exact' | 'relative' | 'pasted';

interface AgentQuotaDialogProps {
  account: AgentAccount | null;
  isOpen: boolean;
  isSaving: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (values: SaveAgentQuotaInput) => Promise<void>;
  quota: AgentQuota | null;
}

export function AgentQuotaDialog({
  account,
  isOpen,
  isSaving,
  onOpenChange,
  onSubmit,
  quota,
}: AgentQuotaDialogProps) {
  const previewReset = usePreviewAgentResetMutation();
  const {
    control,
    formState: { errors },
    handleSubmit,
  } = useForm<AgentQuotaFormValues>({
    defaultValues: defaults(account, quota),
    resolver: zodResolver(agentQuotaFormSchema),
  });
  const timezone = useWatch({ control, name: 'timezone' });
  const [mode, setMode] = useState<ResetMode>('exact');
  const [date, setDate] = useState(defaultDate());
  const [time, setTime] = useState('09:00');
  const [days, setDays] = useState('0');
  const [hours, setHours] = useState('1');
  const [minutes, setMinutes] = useState('0');
  const [pasted, setPasted] = useState('');
  const [preview, setPreview] = useState<ResetPreview | null>(
    quota
      ? {
          hadExplicitTimezone: false,
          interpretation: formatDate(quota.resetAt, quota.timezone),
          method: 'exact',
          resetAt: quota.resetAt,
          timezone: quota.timezone,
        }
      : null,
  );
  const [isConfirmed, setIsConfirmed] = useState(Boolean(quota));
  const [previewError, setPreviewError] = useState<string | null>(null);

  function invalidatePreview() {
    setPreview(null);
    setIsConfirmed(false);
    setPreviewError(null);
  }

  async function buildPreview() {
    setPreviewError(null);
    try {
      const result = await previewReset.mutateAsync(
        mode === 'exact'
          ? { date, method: 'exact', time, timezone }
          : mode === 'relative'
            ? {
                days: numberInput(days),
                hours: numberInput(hours),
                method: 'relative',
                minutes: numberInput(minutes),
                timezone,
              }
            : { method: 'pasted', text: pasted, timezone },
      );
      setPreview(result);
      setIsConfirmed(false);
    } catch {
      setPreviewError(
        'The reset time could not be interpreted. Add a complete date and time, or use an ISO timestamp.',
      );
    }
  }

  const submit = handleSubmit(
    async (values) => {
      if (!account || !preview || !isConfirmed) return;
      await onSubmit({
        accountId: account.id,
        ...(quota ? { id: quota.id } : {}),
        label: values.label.trim(),
        remainingPercent: values.remainingPercent.trim()
          ? Number(values.remainingPercent)
          : null,
        reminders: {
          oneDayBefore: values.remindOneDayBefore,
          resetDay: values.remindResetDay,
          resetReached: values.remindResetReached,
        },
        resetAt: preview.resetAt,
        timezone: values.timezone,
        trackingSource: preview.method === 'pasted' ? 'pasted' : 'manual',
      });
    },
    () => {
      setPreviewError('Review the highlighted required quota fields.');
    },
  );

  return (
    <DevventoryDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      scroll
      size="lg"
    >
      <DialogHeader
        icon={
          <IconClock
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
        }
        title={quota ? 'Edit quota window' : 'Add quota window'}
      />
      <DialogBody>
        <Form
          className="space-y-5"
          onSubmit={(event) => event.preventDefault()}
          validationBehavior="aria"
        >
          <div className="rounded border border-divider bg-workspace px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Account
            </p>
            <p className="mt-1 break-all text-sm font-medium">
              {account?.identifier}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="label"
              render={({ field }) => (
                <TextField
                  fullWidth
                  isInvalid={Boolean(errors.label)}
                  variant="secondary"
                >
                  <Label>Quota window label</Label>
                  <Input
                    autoFocus
                    disabled={isSaving}
                    onChange={(event) => field.onChange(event.target.value)}
                    placeholder="Weekly"
                    value={field.value}
                  />
                  <FieldError>{errors.label?.message}</FieldError>
                </TextField>
              )}
            />
            <Controller
              control={control}
              name="remainingPercent"
              render={({ field }) => (
                <TextField
                  fullWidth
                  isInvalid={Boolean(errors.remainingPercent)}
                  variant="secondary"
                >
                  <Label>Usage remaining (optional %)</Label>
                  <Input
                    disabled={isSaving}
                    inputMode="decimal"
                    onChange={(event) => field.onChange(event.target.value)}
                    placeholder="Unknown"
                    value={field.value}
                  />
                  <FieldError>{errors.remainingPercent?.message}</FieldError>
                </TextField>
              )}
            />
          </div>

          <Controller
            control={control}
            name="timezone"
            render={({ field }) => (
              <Select
                fullWidth
                isDisabled={isSaving}
                onChange={(value) => {
                  field.onChange(value);
                  invalidatePreview();
                }}
                value={field.value}
                variant="secondary"
              >
                <Label>Reset timezone</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {TIMEZONE_OPTIONS.map((item) => (
                      <ListBox.Item id={item} key={item} textValue={item}>
                        <Label>{item}</Label>
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            )}
          />

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Reset entry method</legend>
            <div className="flex flex-wrap gap-2" role="group">
              {(
                [
                  ['exact', 'Exact date & time'],
                  ['relative', 'Reset in'],
                  ['pasted', 'Paste message'],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  onPress={() => {
                    setMode(value);
                    invalidatePreview();
                  }}
                  size="sm"
                  variant={mode === value ? 'primary' : 'secondary'}
                >
                  {label}
                </Button>
              ))}
            </div>

            {mode === 'exact' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField fullWidth variant="secondary">
                  <Label>Reset date</Label>
                  <Input
                    onChange={(event) => {
                      setDate(event.target.value);
                      invalidatePreview();
                    }}
                    type="date"
                    value={date}
                  />
                </TextField>
                <TextField fullWidth variant="secondary">
                  <Label>Reset time</Label>
                  <Input
                    onChange={(event) => {
                      setTime(event.target.value);
                      invalidatePreview();
                    }}
                    type="time"
                    value={time}
                  />
                </TextField>
              </div>
            )}

            {mode === 'relative' && (
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['Days', days, setDays],
                  ['Hours', hours, setHours],
                  ['Minutes', minutes, setMinutes],
                ].map(([label, value, setter]) => (
                  <TextField
                    fullWidth
                    key={label as string}
                    variant="secondary"
                  >
                    <Label>{label as string}</Label>
                    <Input
                      min="0"
                      onChange={(event) => {
                        (setter as (value: string) => void)(event.target.value);
                        invalidatePreview();
                      }}
                      type="number"
                      value={value as string}
                    />
                  </TextField>
                ))}
              </div>
            )}

            {mode === 'pasted' && (
              <TextField fullWidth variant="secondary">
                <Label>Provider reset message</Label>
                <TextArea
                  onChange={(event) => {
                    setPasted(event.target.value);
                    invalidatePreview();
                  }}
                  placeholder="Your limit resets Friday at 3:00 PM"
                  rows={3}
                  value={pasted}
                />
                <p className="text-xs text-muted">
                  Parsing is deterministic and local. The message is never sent
                  to an AI service.
                </p>
              </TextField>
            )}

            <Button
              isDisabled={previewReset.isPending}
              onPress={() => void buildPreview()}
              size="sm"
              variant="secondary"
            >
              {previewReset.isPending && (
                <Spinner aria-label="Interpreting reset" size="sm" />
              )}
              Preview reset
            </Button>
            {previewError && (
              <p className="text-sm text-danger" role="alert">
                {previewError}
              </p>
            )}
          </fieldset>

          {preview && (
            <Alert status="success">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Interpreted reset</Alert.Title>
                <Alert.Description>{preview.interpretation}</Alert.Description>
                <Checkbox
                  className="mt-2"
                  isSelected={isConfirmed}
                  onChange={setIsConfirmed}
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Label>I confirm this interpreted reset time</Label>
                  </Checkbox.Content>
                </Checkbox>
              </Alert.Content>
            </Alert>
          )}

          <fieldset className="space-y-2 rounded border border-divider bg-workspace p-3">
            <legend className="px-1 text-sm font-medium">
              In-app reminders
            </legend>
            {(
              [
                ['remindOneDayBefore', 'One day before reset'],
                ['remindResetDay', 'On reset day'],
                ['remindResetReached', 'When reset time is reached'],
              ] as const
            ).map(([name, label]) => (
              <Controller
                control={control}
                key={name}
                name={name}
                render={({ field }) => (
                  <Checkbox isSelected={field.value} onChange={field.onChange}>
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <Label>{label}</Label>
                    </Checkbox.Content>
                  </Checkbox>
                )}
              />
            ))}
          </fieldset>
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
          isDisabled={isSaving || !preview || !isConfirmed}
          onPress={() => void submit()}
          size="sm"
          variant="primary"
        >
          {isSaving && <Spinner aria-label="Saving quota" size="sm" />}
          Save quota
        </Button>
      </DialogFooter>
    </DevventoryDialog>
  );
}

function defaults(
  account: AgentAccount | null,
  quota: AgentQuota | null,
): AgentQuotaFormValues {
  return {
    label: quota?.label ?? 'Weekly',
    remainingPercent:
      quota?.remainingPercent == null ? '' : String(quota.remainingPercent),
    remindOneDayBefore: quota?.reminders.oneDayBefore ?? true,
    remindResetDay: quota?.reminders.resetDay ?? true,
    remindResetReached: quota?.reminders.resetReached ?? true,
    timezone: quota?.timezone ?? account?.defaultTimezone ?? DEFAULT_TIMEZONE,
  };
}

function defaultDate(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function numberInput(value: string): number {
  const parsed = Number.parseInt(value || '0', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function formatDate(value: string, timezone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value));
}
