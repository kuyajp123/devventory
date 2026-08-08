import { arrayMove } from '@dnd-kit/sortable';

export const KEY_COLUMN_WIDTH_PX = 256;
export const ENVIRONMENT_COLUMN_WIDTH_PX = 208;

export const KEY_COLUMN_CLASS =
  'sticky left-0 z-30 w-64 min-w-64 max-w-64 bg-surface';
export const ENVIRONMENT_COLUMN_CLASS =
  'w-52 min-w-52 max-w-52 box-border p-0 align-top';

export function getMatrixTableMinWidth(environmentCount: number): number {
  return KEY_COLUMN_WIDTH_PX + environmentCount * ENVIRONMENT_COLUMN_WIDTH_PX;
}

export function reorderEnvironmentIds(
  environmentIds: readonly string[],
  activeId: string,
  overId: string,
): string[] {
  const oldIndex = environmentIds.indexOf(activeId);
  const newIndex = environmentIds.indexOf(overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
    return [...environmentIds];
  }
  return arrayMove([...environmentIds], oldIndex, newIndex);
}

export function resolveEnvironmentReorder(
  orderedEnvironmentIds: readonly string[],
  activeId: string | null,
  overId: string | null,
): string[] | null {
  if (!activeId || !overId || activeId === overId) {
    return null;
  }

  const nextIds = reorderEnvironmentIds(
    orderedEnvironmentIds,
    activeId,
    overId,
  );
  if (areEnvironmentOrdersEqual(nextIds, orderedEnvironmentIds)) {
    return null;
  }

  return nextIds;
}

export function areEnvironmentOrdersEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((environmentId, index) => environmentId === right[index])
  );
}

export function mergePreferredEnvironmentOrder(
  matrixEnvironmentIds: readonly string[],
  preferredEnvironmentIds: readonly string[],
): string[] {
  const availableIds = new Set(matrixEnvironmentIds);
  const preferredIds = preferredEnvironmentIds.filter((environmentId) =>
    availableIds.has(environmentId),
  );
  const preferredIdSet = new Set(preferredIds);

  return [
    ...preferredIds,
    ...matrixEnvironmentIds.filter(
      (environmentId) => !preferredIdSet.has(environmentId),
    ),
  ];
}
