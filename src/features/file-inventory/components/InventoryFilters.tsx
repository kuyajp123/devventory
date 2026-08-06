import {
  Button,
  Form,
  Input,
  Label,
  ListBox,
  SearchField,
  Select,
  TextField,
} from '@heroui/react';
import { IconFilter, IconRefresh } from '@tabler/icons-react';
import { type FormEvent, useState } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  fileCategoryOptions,
  type FileCategory,
  type FileStatus,
} from '../models/file-inventory';

export interface InventoryFilterValues {
  category?: FileCategory;
  extension?: string;
  search?: string;
  status?: FileStatus;
}

interface InventoryFiltersProps {
  values: InventoryFilterValues;
  onApply: (values: InventoryFilterValues) => void;
  onReset: () => void;
}

const ALL_ITEMS = 'all';

export function InventoryFilters({
  values,
  onApply,
  onReset,
}: InventoryFiltersProps) {
  const [search, setSearch] = useState(values.search ?? '');
  const [category, setCategory] = useState<FileCategory | typeof ALL_ITEMS>(
    values.category ?? ALL_ITEMS,
  );
  const [extension, setExtension] = useState(values.extension ?? '');
  const [status, setStatus] = useState<FileStatus | typeof ALL_ITEMS>(
    values.status ?? ALL_ITEMS,
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply({
      category: category === ALL_ITEMS ? undefined : category,
      extension: extension.trim().replace(/^\./, '') || undefined,
      search: search.trim() || undefined,
      status: status === ALL_ITEMS ? undefined : status,
    });
  }

  function reset() {
    setSearch('');
    setCategory(ALL_ITEMS);
    setExtension('');
    setStatus(ALL_ITEMS);
    onReset();
  }

  return (
    <Form
      className="rounded-xl border border-divider bg-surface p-4 sm:p-5"
      onSubmit={submit}
      validationBehavior="aria"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SearchField
          className="xl:col-span-2"
          fullWidth
          onChange={setSearch}
          value={search}
          variant="secondary"
        >
          <Label>Search file name or path</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input
              maxLength={128}
              placeholder="main.ts or src/components"
            />
            <SearchField.ClearButton aria-label="Clear file search" />
          </SearchField.Group>
        </SearchField>

        <Select
          fullWidth
          onChange={(value) =>
            setCategory((value ?? ALL_ITEMS) as FileCategory | typeof ALL_ITEMS)
          }
          value={category}
          variant="secondary"
        >
          <Label>Category</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={ALL_ITEMS} textValue="All categories">
                <Label>All categories</Label>
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {fileCategoryOptions.map((option) => (
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

        <Select
          fullWidth
          onChange={(value) =>
            setStatus((value ?? ALL_ITEMS) as FileStatus | typeof ALL_ITEMS)
          }
          value={status}
          variant="secondary"
        >
          <Label>Status</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={ALL_ITEMS} textValue="All statuses">
                <Label>All statuses</Label>
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="active" textValue="Active">
                <Label>Active</Label>
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="missing" textValue="Missing">
                <Label>Missing</Label>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>

        <TextField
          className="sm:max-w-xs"
          fullWidth
          onChange={setExtension}
          value={extension}
          variant="secondary"
        >
          <Label>Extension</Label>
          <Input maxLength={33} placeholder="tsx" />
        </TextField>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="submit" variant="primary">
          <IconFilter
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
          Apply filters
        </Button>
        <Button onPress={reset} type="button" variant="secondary">
          <IconRefresh
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
          Reset
        </Button>
      </div>
    </Form>
  );
}
