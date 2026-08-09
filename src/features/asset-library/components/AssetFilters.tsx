import {
  Button,
  Form,
  Input,
  Label,
  SearchField,
  TextField,
} from '@heroui/react';
import { IconFilter, IconRefresh } from '@tabler/icons-react';
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
      className="rounded-md border border-divider bg-surface p-4 sm:p-5"
      onSubmit={submit}
      validationBehavior="aria"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SearchField
          className="sm:col-span-2"
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

        <AssetFilterSelect
          label="Category"
          onChange={(value) =>
            setCategory((value ?? ALL_ITEMS) as FileCategory | typeof ALL_ITEMS)
          }
          options={fileCategoryOptions}
          value={category}
        />
        <AssetFilterSelect
          label="Origin"
          onChange={(value) =>
            setOrigin((value ?? ALL_ITEMS) as AssetOrigin | typeof ALL_ITEMS)
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
            setFavorite((value ?? ALL_ITEMS) as 'favorites' | typeof ALL_ITEMS)
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
        <TextField fullWidth onChange={setTag} value={tag} variant="secondary">
          <Label>Tag</Label>
          <Input maxLength={40} placeholder="brand" />
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
