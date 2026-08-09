import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Calendar,
  Checkbox,
  DateField,
  DatePicker,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  TextField,
  Tooltip,
} from '@heroui/react';
import { parseDate, today } from '@internationalized/date';
import type { CalendarDate, DateValue } from '@internationalized/date';
import { IconClock } from '@tabler/icons-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  DevventoryDialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '@/shared/ui';
import {
  buildExactResetAt,
  buildRelativeResetAt,
  parseExistingResetAt,
} from './reset-at';
import {
  agentQuotaFormSchema,
  DEFAULT_TIMEZONE,
  TIMEZONE_OPTIONS,
  type AgentAccount,
  type AgentQuota,
  type AgentQuotaFormValues,
  type AgentQuotaSaveError,
  type SaveAgentQuotaInput,
} from '../models/agent-usage';

type ResetMode = 'exact' | 'relative';

interface AgentQuotaDialogProps {
  account: AgentAccount | null;
  isOpen: boolean;
  isSaving: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSaveErrorClear: () => void;
  onSubmit: (values: SaveAgentQuotaInput) => Promise<void>;
  quota: AgentQuota | null;
  saveError: AgentQuotaSaveError | null;
}

function defaultCalDate(): CalendarDate {
  return today('UTC').add({ days: 1 });
}

function initExactFields(quota: AgentQuota | null, timezone: string) {
  if (quota?.resetAt) {
    return parseExistingResetAt(quota.resetAt, timezone);
  }
  return { calDate: defaultCalDate(), time: '09:00' };
}

export function AgentQuotaDialog({
  account,
  isOpen,
  isSaving,
  onOpenChange,
  onSaveErrorClear,
  onSubmit,
  quota,
  saveError,
}: AgentQuotaDialogProps) {
  const initialTimezone =
    quota?.timezone ?? account?.defaultTimezone ?? DEFAULT_TIMEZONE;
  const initialExact = initExactFields(quota, initialTimezone);

  const {
    control,
    formState: { errors },
    handleSubmit,
  } = useForm<AgentQuotaFormValues>({
    defaultValues: defaults(account, quota),
    resolver: zodResolver(agentQuotaFormSchema),
  });

  const [mode, setMode] = useState<ResetMode>('exact');
  const [calDate, setCalDate] = useState<CalendarDate>(initialExact.calDate);
  const [time, setTime] = useState(initialExact.time);
  const [days, setDays] = useState('0');
  const [hours, setHours] = useState('1');
  const [minutes, setMinutes] = useState('0');
  const [resetError, setResetError] = useState<string | null>(null);

  function computeResetAt(timezone: string): string | null {
    if (mode === 'exact') {
      return buildExactResetAt(calDate, time, timezone);
    }
    return buildRelativeResetAt(
      numberInput(days),
      numberInput(hours),
      numberInput(minutes),
    );
  }

  const submit = handleSubmit(
    async (values) => {
      if (!account) return;
      const resetAt = computeResetAt(values.timezone);
      if (!resetAt) {
        setResetError(
          mode === 'exact'
            ? 'Enter a valid future date and time for the reset.'
            : 'Enter a positive duration (at least 1 minute).',
        );
        return;
      }
      setResetError(null);
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
        resetAt,
        timezone: values.timezone,
        trackingSource: 'manual',
      });
    },
    () => {
      setResetError('Review the highlighted required quota fields.');
    },
  );

  return (
    <DevventoryDialog
      bodyScrollable={false}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
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
      <DialogBody scrollable={false}>
        <Form
          className="space-y-3"
          onSubmit={(event) => event.preventDefault()}
          validationBehavior="aria"
        >
          {/* Account contextual info — non-editable plain text */}
          <div className="flex items-center gap-1.5 text-xs text-muted mb-6">
            <span>Account</span>
            <span aria-hidden="true">·</span>
            {account?.identifier ? (
              <Tooltip delay={0}>
                <span className="truncate font-medium text-foreground">
                  {account.identifier}
                </span>
                <Tooltip.Content>
                  <p>{account.identifier}</p>
                </Tooltip.Content>
              </Tooltip>
            ) : (
              <span className="font-medium text-foreground">—</span>
            )}
          </div>

          {/* Save error */}
          {saveError?.field === 'form' && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Quota window could not be saved</Alert.Title>
                <Alert.Description>{saveError.message}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          {/* Window settings */}
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">
              Window settings
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Controller
                control={control}
                name="label"
                render={({ field }) => (
                  <TextField
                    fullWidth
                    isInvalid={Boolean(
                      errors.label || saveError?.field === 'label',
                    )}
                    variant="secondary"
                  >
                    <Label>Quota window label</Label>
                    <Input
                      autoFocus
                      disabled={isSaving}
                      onChange={(event) => {
                        field.onChange(event.target.value);
                        if (saveError?.field === 'label') onSaveErrorClear();
                      }}
                      placeholder="Weekly"
                      value={field.value}
                    />
                    <FieldError>
                      {errors.label?.message ??
                        (saveError?.field === 'label'
                          ? saveError.message
                          : undefined)}
                    </FieldError>
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
          </div>

          {/* Timezone */}
          <Controller
            control={control}
            name="timezone"
            render={({ field }) => (
              <Select
                fullWidth
                isDisabled={isSaving}
                onChange={(value) => {
                  field.onChange(value);
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

          {/* Reset entry method */}
          <fieldset className="space-y-2.5">
            <legend className="text-xs font-medium uppercase tracking-wider text-muted">
              Reset entry method
            </legend>

            {/* Segmented mode toggle — connected segmented control */}
            <div
              aria-label="Reset entry method"
              className="flex w-full overflow-hidden rounded border border-divider bg-workspace"
              role="group"
            >
              {(
                [
                  ['exact', 'Exact date & time'],
                  ['relative', 'Reset in'],
                ] as const
              ).map(([value, label], index) => (
                <button
                  aria-pressed={mode === value}
                  className={[
                    'flex-1 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
                    index === 0 ? '' : 'border-l border-divider',
                    mode === value
                      ? 'bg-accent text-white'
                      : 'bg-transparent text-muted hover:bg-workspace-hover hover:text-primary',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  key={value}
                  onClick={() => {
                    setMode(value);
                    setResetError(null);
                  }}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Exact date & time */}
            {mode === 'exact' && (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {/* HeroUI DatePicker for Reset Date with full Calendar compound composition */}
                <div className="flex flex-col gap-1">
                  <Label className="text-sm">Reset date</Label>
                  <DatePicker
                    aria-label="Reset date"
                    isDisabled={isSaving}
                    minValue={today('UTC')}
                    onChange={(v: DateValue | null) => {
                      if (v) {
                        setCalDate(parseDate(v.toString()));
                        setResetError(null);
                      }
                    }}
                    value={calDate}
                  >
                    <DateField.Group>
                      <DateField.Input>
                        {(segment) => <DateField.Segment segment={segment} />}
                      </DateField.Input>
                      <DateField.Suffix>
                        <DatePicker.Trigger>
                          <DatePicker.TriggerIndicator />
                        </DatePicker.Trigger>
                      </DateField.Suffix>
                    </DateField.Group>
                    <DatePicker.Popover placement="bottom start">
                      <Calendar aria-label="Choose reset date">
                        <Calendar.Header>
                          <Calendar.NavButton slot="previous" />
                          <Calendar.Heading />
                          <Calendar.NavButton slot="next" />
                        </Calendar.Header>
                        <Calendar.Grid>
                          <Calendar.GridHeader>
                            {(day) => (
                              <Calendar.HeaderCell>{day}</Calendar.HeaderCell>
                            )}
                          </Calendar.GridHeader>
                          <Calendar.GridBody>
                            {(date) => <Calendar.Cell date={date} />}
                          </Calendar.GridBody>
                        </Calendar.Grid>
                      </Calendar>
                    </DatePicker.Popover>
                  </DatePicker>
                </div>

                {/* Time input */}
                <TextField fullWidth variant="secondary">
                  <Label>Reset time</Label>
                  <Input
                    disabled={isSaving}
                    onChange={(event) => {
                      setTime(event.target.value);
                      setResetError(null);
                    }}
                    type="time"
                    value={time}
                  />
                </TextField>
              </div>
            )}

            {/* Relative duration */}
            {mode === 'relative' && (
              <div className="grid gap-2.5 sm:grid-cols-3">
                {(
                  [
                    ['Days', days, setDays],
                    ['Hours', hours, setHours],
                    ['Minutes', minutes, setMinutes],
                  ] as const
                ).map(([label, value, setter]) => (
                  <TextField fullWidth key={label} variant="secondary">
                    <Label>{label}</Label>
                    <Input
                      min="0"
                      onChange={(event) => {
                        setter(event.target.value);
                        setResetError(null);
                      }}
                      type="number"
                      value={value}
                    />
                  </TextField>
                ))}
              </div>
            )}

            {/* Reset validation error */}
            {resetError && (
              <p className="text-sm text-danger" role="alert">
                {resetError}
              </p>
            )}
          </fieldset>

          {/* In-app reminders */}
          <fieldset className="space-y-1.5 rounded border border-divider bg-workspace p-2.5">
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
          isDisabled={isSaving}
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

function numberInput(value: string): number {
  const parsed = Number.parseInt(value || '0', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
