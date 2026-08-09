import { Label, ListBox, SearchField, Select } from '@heroui/react';
import {
  type FileCategory,
  type FileStatus,
  fileCategoryOptions,
} from '../models/file-inventory';

export type InventoryView = 'explorer' | 'allFiles';

interface ExplorerToolbarProps {
  category: FileCategory | undefined;
  onCategoryChange: (category: FileCategory | undefined) => void;
  onSearchChange: (search: string) => void;
  onStatusChange: (status: FileStatus | undefined) => void;
  onViewChange: (view: InventoryView) => void;
  search: string;
  status: FileStatus | undefined;
  view: InventoryView;
}

const ALL_ITEMS = 'all';

export function ExplorerToolbar({
  category,
  onCategoryChange,
  onSearchChange,
  onStatusChange,
  onViewChange,
  search,
  status,
  view,
}: ExplorerToolbarProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      {view === 'explorer' ? (
        <div className="flex flex-1 flex-wrap items-end gap-3 min-w-0">
          <SearchField
            className="min-w-48 flex-1"
            onChange={onSearchChange}
            value={search}
            variant="secondary"
          >
            <Label className="sr-only">Search files and folders</Label>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input
                maxLength={128}
                placeholder="Search files and folders…"
              />
              <SearchField.ClearButton aria-label="Clear search" />
            </SearchField.Group>
          </SearchField>

          <Select
            className="w-36"
            onChange={(value) =>
              onCategoryChange(
                value === ALL_ITEMS ? undefined : (value as FileCategory),
              )
            }
            value={category ?? ALL_ITEMS}
            variant="secondary"
          >
            <Label className="sr-only">Category</Label>
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
            className="w-32"
            onChange={(value) =>
              onStatusChange(
                value === ALL_ITEMS ? undefined : (value as FileStatus),
              )
            }
            value={status ?? ALL_ITEMS}
            variant="secondary"
          >
            <Label className="sr-only">Status</Label>
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
        </div>
      ) : (
        <div />
      )}

      <div
        aria-label="View mode"
        className="ml-auto inline-flex rounded-md border border-divider bg-surface p-0.5"
        role="group"
      >
        <button
          aria-pressed={view === 'explorer'}
          className={`rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
            view === 'explorer'
              ? 'bg-elevated text-accent'
              : 'text-muted hover:text-foreground'
          }`}
          onClick={() => onViewChange('explorer')}
          type="button"
        >
          Explorer
        </button>
        <button
          aria-pressed={view === 'allFiles'}
          className={`rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
            view === 'allFiles'
              ? 'bg-elevated text-accent'
              : 'text-muted hover:text-foreground'
          }`}
          onClick={() => onViewChange('allFiles')}
          type="button"
        >
          All files
        </button>
      </div>
    </div>
  );
}
