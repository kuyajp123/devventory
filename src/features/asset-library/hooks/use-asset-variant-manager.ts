import { toast } from '@heroui/react';
import { useEffect, useRef, useState } from 'react';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import {
  variantPathSchema,
  type Asset,
  type VariantCandidate,
  type VariantCandidateScope,
} from '../models/asset';
import {
  useAssetVariantsQuery,
  useResolveVariantPathMutation,
  useUpdateAssetVariantsMutation,
  useVariantCandidatesQuery,
} from './use-assets';
import { useDebouncedValue } from './use-debounced-value';

const PAGE_SIZE = 25;

export function useAssetVariantManager(asset: Asset) {
  const [scope, setScope] = useState<VariantCandidateScope>('suggested');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<VariantCandidate[]>([]);
  const [manualPath, setManualPath] = useState('');
  const [manualError, setManualError] = useState<string>();
  const initializedAsset = useRef<string | undefined>(undefined);
  const persisted = useAssetVariantsQuery(asset.projectId, asset.id);
  const excludedIds = selected.map((variant) => variant.id);
  const debouncedSearch = useDebouncedValue(search.trim());
  const debouncedManualPath = useDebouncedValue(manualPath.trim());
  const candidates = useVariantCandidatesQuery(
    asset.projectId,
    asset.id,
    {
      excludedIds,
      page,
      pageSize: PAGE_SIZE,
      scope,
      search: debouncedSearch || undefined,
    },
    persisted.isSuccess,
  );
  const autocomplete = useVariantCandidatesQuery(
    asset.projectId,
    asset.id,
    {
      excludedIds,
      page: 1,
      pageSize: 5,
      scope: 'all',
      search: debouncedManualPath || undefined,
    },
    persisted.isSuccess && debouncedManualPath.length >= 2,
  );
  const resolvePath = useResolveVariantPathMutation(asset.projectId, asset.id);
  const updateVariants = useUpdateAssetVariantsMutation(asset.projectId);

  useEffect(() => {
    if (persisted.data && initializedAsset.current !== asset.id) {
      initializedAsset.current = asset.id;
      setSelected(persisted.data);
    }
  }, [asset.id, persisted.data]);

  const add = (candidate: VariantCandidate) => {
    setManualError(undefined);
    setSelected((current) => {
      if (current.some((item) => item.id === candidate.id)) return current;
      if (current.length >= 20) {
        toast.danger('An asset can have up to 20 variants.');
        return current;
      }
      return [...current, candidate];
    });
  };

  const addManualPath = async () => {
    const parsed = variantPathSchema.safeParse(manualPath);
    if (!parsed.success) {
      setManualError(parsed.error.issues[0]?.message);
      return;
    }
    setManualError(undefined);
    try {
      const candidate = await resolvePath.mutateAsync({
        relativePath: parsed.data,
        selectedVariantIds: excludedIds,
      });
      add(candidate);
      setManualPath('');
    } catch (error) {
      setManualError(
        commandMessage(
          error,
          'That indexed path could not be added as a variant.',
        ),
      );
    }
  };

  const save = async () => {
    try {
      const updated = await updateVariants.mutateAsync({
        assetId: asset.id,
        variantIds: excludedIds,
      });
      toast.success('Asset variants saved');
      return updated;
    } catch (error) {
      toast.danger(commandMessage(error, 'Asset variants could not be saved.'));
      return null;
    }
  };

  return {
    add,
    addManualPath,
    autocomplete,
    cancel: () => {
      setSelected(persisted.data ?? []);
      setManualPath('');
      setManualError(undefined);
    },
    candidates,
    manualError,
    manualPath,
    page,
    persisted,
    remove: (id: string) =>
      setSelected((current) => current.filter((variant) => variant.id !== id)),
    resolvePath,
    save,
    scope,
    search,
    selected,
    setManualPath: (value: string) => {
      setManualPath(value);
      setManualError(undefined);
    },
    setPage,
    setScope: (value: VariantCandidateScope) => {
      setScope(value);
      setPage(1);
    },
    setSearch: (value: string) => {
      setSearch(value);
      setPage(1);
    },
    updateVariants,
  };
}

function commandMessage(error: unknown, fallback: string) {
  return error instanceof TauriCommandError ? error.message : fallback;
}
