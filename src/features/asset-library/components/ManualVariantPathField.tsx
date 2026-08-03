import {
  Button,
  Card,
  FieldError,
  Form,
  Input,
  Label,
  Spinner,
  TextField,
} from '@heroui/react';
import { IconCornerDownLeft, IconFile } from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import type { VariantCandidate } from '../models/asset';

interface ManualVariantPathFieldProps {
  error?: string;
  isPending: boolean;
  onAdd: () => void;
  onChange: (value: string) => void;
  suggestions: VariantCandidate[];
  value: string;
}

export function ManualVariantPathField({
  error,
  isPending,
  onAdd,
  onChange,
  suggestions,
  value,
}: ManualVariantPathFieldProps) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>Add by project-relative path</Card.Title>
        <Card.Description>
          Paste an indexed path when the file is not in the current results.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <Form
          className="flex flex-col gap-2 sm:flex-row sm:items-start"
          onSubmit={(event) => {
            event.preventDefault();
            onAdd();
          }}
          validationBehavior="aria"
        >
          <div className="relative min-w-0 flex-1">
            <TextField fullWidth isInvalid={Boolean(error)} variant="secondary">
              <Label>Project-relative file path</Label>
              <Input
                autoComplete="off"
                onChange={(event) => onChange(event.target.value)}
                placeholder="assets/branding/logo-dark.png"
                value={value}
              />
              <FieldError>{error}</FieldError>
            </TextField>
            {value.trim().length >= 2 && suggestions.length > 0 && (
              <ul
                aria-label="Indexed path suggestions"
                className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-default bg-surface p-1 shadow-lg"
              >
                {suggestions.map((suggestion) => (
                  <li key={suggestion.id}>
                    <Button
                      className="w-full justify-start"
                      onPress={() => onChange(suggestion.relativePath)}
                      size="sm"
                      variant="ghost"
                    >
                      <IconFile
                        aria-hidden="true"
                        className="shrink-0"
                        size={ICON_SIZE.small}
                        stroke={ICON_STROKE}
                      />
                      <span className="truncate font-mono text-xs">
                        {suggestion.relativePath}
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button
            aria-label="Add path"
            className="sm:mt-6"
            isDisabled={isPending}
            type="submit"
            variant="primary"
          >
            {isPending ? (
              <Spinner aria-label="Validating variant path" size="sm" />
            ) : (
              <IconCornerDownLeft
                aria-hidden="true"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
            )}
            Add
          </Button>
        </Form>
      </Card.Content>
    </Card>
  );
}
