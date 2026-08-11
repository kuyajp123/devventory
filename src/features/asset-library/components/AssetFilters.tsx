import {
  Button,
  Chip,
  Form,
  Input,
  Label,
  SearchField,
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
} from '@/shared/models/indexed-file';
import type { AssetOrigin } from '../models/asset';
import { AssetFilterSelect } from './AssetFilterSelect';

export interface AssetFilterValues {
  category?: FileCategory;
  extension?: string;
  favorite?: boolean;
  origin?: AssetOrigin;
  search?: string;
  tag?: string;
}

interface AssetFiltersProps {
  onApply: (values: AssetFilterValues) => void;
  onReset: () => void;
  values: AssetFilterValues;
}

const ALL_ITEMS = 'all';

export function AssetFilters({ onApply, onReset, values }: AssetFiltersProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [search, setSearch] = useState(values.search ?? '');
  const [category, setCategory] = useState<FileCategory | typeof ALL_ITEMS>(
    values.category ?? ALL_ITEMS,
  );
  const [origin, setOrigin] = useState<AssetOrigin | typeof ALL_ITEMS>(
    values.origin ?? ALL_ITEMS,
  );
  const [favorite, setFavorite] = useState<'favorites' | typeof ALL_ITEMS>(
    values.favorite ? 'favorites' : ALL_ITEMS,
  );
  const [extension, setExtension] = useState(values.extension ?? '');
  const [tag, setTag] = useState(values.tag ?? '');
  const activeAdvancedFilterCount =
    (category !== ALL_ITEMS ? 1 : 0) +
    (origin !== ALL_ITEMS ? 1 : 0) +
    (favorite !== ALL_ITEMS ? 1 : 0) +
    (extension.trim() ? 1 : 0) +
    (tag.trim() ? 1 : 0);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply({
      category: category === ALL_ITEMS ? undefined : category,
      extension: extension.trim().replace(/^\./, '') || undefined,
      favorite: favorite === 'favorites' ? true : undefined,
      origin: origin === ALL_ITEMS ? undefined : origin,
      search: search.trim() || undefined,
      tag: tag.trim() || undefined,
    });
  }

  function reset() {
    setSearch('');
    setCategory(ALL_ITEMS);
    setOrigin(ALL_ITEMS);
    setFavorite(ALL_ITEMS);
    setExtension('');
    setTag('');
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
          <Label>Search name or relative path</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input
              maxLength={128}
              placeholder="logo or assets/icons"
            />
            <SearchField.ClearButton aria-label="Clear asset search" />
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
          aria-controls="asset-advanced-filters"
          aria-expanded={isAdvancedOpen}
          aria-label="Toggle advanced asset filters"
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
          id="asset-advanced-filters"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <AssetFilterSelect
              label="Category"
              onChange={(value) =>
                setCategory(
                  (value ?? ALL_ITEMS) as FileCategory | typeof ALL_ITEMS,
                )
              }
              options={fileCategoryOptions}
              value={category}
            />
            <AssetFilterSelect
              label="Origin"
              onChange={(value) =>
                setOrigin(
                  (value ?? ALL_ITEMS) as AssetOrigin | typeof ALL_ITEMS,
                )
              }
              options={[
                { label: 'Managed imports', value: 'managed' },
                { label: 'Discovered files', value: 'discovered' },
              ]}
              value={origin}
            />
            <AssetFilterSelect
              label="Favorites"
              onChange={(value) =>
                setFavorite(
                  (value ?? ALL_ITEMS) as 'favorites' | typeof ALL_ITEMS,
                )
              }
              options={[{ label: 'Favorites only', value: 'favorites' }]}
              value={favorite}
            />
            <TextField
              fullWidth
              onChange={setExtension}
              value={extension}
              variant="secondary"
            >
              <Label>Extension</Label>
              <Input maxLength={33} placeholder="png" />
            </TextField>
            <TextField
              fullWidth
              onChange={setTag}
              value={tag}
              variant="secondary"
            >
              <Label>Tag</Label>
              <Input maxLength={40} placeholder="brand" />
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
