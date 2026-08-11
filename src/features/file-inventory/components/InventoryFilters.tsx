import {
  Button,
  Chip,
  Form,
  Input,
  Label,
  ListBox,
  SearchField,
  Select,
  TextField,
} from '@heroui/react';
import {
  IconChevronDown,
  IconChevronUp,
  IconFilter,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react';
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
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [search, setSearch] = useState(values.search ?? '');
  const [category, setCategory] = useState<FileCategory | typeof ALL_ITEMS>(
    values.category ?? ALL_ITEMS,
  );
  const [extension, setExtension] = useState(values.extension ?? '');
  const [status, setStatus] = useState<FileStatus | typeof ALL_ITEMS>(
    values.status ?? ALL_ITEMS,
  );
  const activeAdvancedFilterCount =
    (category !== ALL_ITEMS ? 1 : 0) +
    (status !== ALL_ITEMS ? 1 : 0) +
    (extension.trim() ? 1 : 0);

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
      className="rounded-md border border-divider bg-surface p-3"
      onSubmit={submit}
      validationBehavior="aria"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <SearchField
          className="flex-1"
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

        <Button className="sm:min-w-24" type="submit" variant="primary">
          <IconSearch
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
          Search
        </Button>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <Button
          aria-controls="file-inventory-advanced-filters"
          aria-expanded={isAdvancedOpen}
          aria-label="Toggle advanced file filters"
          className="h-7 gap-1.5 px-2 font-mono text-xs text-muted hover:text-foreground"
          onPress={() => setIsAdvancedOpen((open) => !open)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <IconFilter
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
          Advanced filters
          {isAdvancedOpen ? (
            <IconChevronUp aria-hidden="true" size={ICON_SIZE.small} />
          ) : (
            <IconChevronDown aria-hidden="true" size={ICON_SIZE.small} />
          )}
        </Button>

        {activeAdvancedFilterCount > 0 ? (
          <Chip size="sm" variant="soft">
            <Chip.Label className="font-mono text-[10px]">
              Filters · {activeAdvancedFilterCount}
            </Chip.Label>
          </Chip>
        ) : null}
      </div>

      {isAdvancedOpen ? (
        <div
          className="mt-3 space-y-3 border-t border-divider pt-3"
          id="file-inventory-advanced-filters"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Select
              fullWidth
              onChange={(value) =>
                setCategory(
                  (value ?? ALL_ITEMS) as FileCategory | typeof ALL_ITEMS,
                )
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
              fullWidth
              onChange={setExtension}
              value={extension}
              variant="secondary"
            >
              <Label>Extension</Label>
              <Input maxLength={33} placeholder="tsx" />
            </TextField>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="submit" variant="primary">
              <IconFilter
                aria-hidden="true"
                size={ICON_SIZE.small}
                stroke={ICON_STROKE}
              />
              Apply filters
            </Button>
            <Button onPress={reset} size="sm" type="button" variant="secondary">
              <IconRefresh
                aria-hidden="true"
                size={ICON_SIZE.small}
                stroke={ICON_STROKE}
              />
              Reset
            </Button>
          </div>
        </div>
      ) : null}
    </Form>
  );
}
