import { Button } from '@heroui/react';
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

const fieldClassName =
  'mt-2 w-full rounded-xl border border-divider bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20';

export function InventoryFilters({
  values,
  onApply,
  onReset,
}: InventoryFiltersProps) {
  const [search, setSearch] = useState(values.search ?? '');
  const [category, setCategory] = useState<FileCategory | ''>(
    values.category ?? '',
  );
  const [extension, setExtension] = useState(values.extension ?? '');
  const [status, setStatus] = useState<FileStatus | ''>(values.status ?? '');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply({
      category: category || undefined,
      extension: extension.trim().replace(/^\./, '') || undefined,
      search: search.trim() || undefined,
      status: status || undefined,
    });
  }

  return (
    <form
      className="rounded-2xl border border-divider bg-surface p-4 sm:p-5"
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-medium xl:col-span-2">
          Search file name or path
          <input
            className={fieldClassName}
            maxLength={128}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="main.ts or src/components"
            type="search"
            value={search}
          />
        </label>
        <label className="text-sm font-medium">
          Category
          <select
            className={fieldClassName}
            onChange={(event) =>
              setCategory(event.target.value as FileCategory | '')
            }
            value={category}
          >
            <option value="">All categories</option>
            {fileCategoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Status
          <select
            className={fieldClassName}
            onChange={(event) =>
              setStatus(event.target.value as FileStatus | '')
            }
            value={status}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="missing">Missing</option>
          </select>
        </label>
        <label className="text-sm font-medium sm:max-w-xs">
          Extension
          <input
            className={fieldClassName}
            maxLength={33}
            onChange={(event) => setExtension(event.target.value)}
            placeholder="tsx"
            value={extension}
          />
        </label>
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
        <Button onPress={onReset} type="button" variant="secondary">
          <IconRefresh
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
          Reset
        </Button>
      </div>
    </form>
  );
}
