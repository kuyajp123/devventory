import { arrayMove } from '@dnd-kit/sortable';

export const KEY_COLUMN_WIDTH_PX = 340;
export const ENVIRONMENT_COLUMN_WIDTH_PX = 220;
export const TOOLBAR_HEIGHT_PX = 48;

export const KEY_COLUMN_CLASS =
  'sticky left-0 z-30 w-[340px] min-w-[340px] max-w-[340px] bg-surface';
export const ENVIRONMENT_COLUMN_CLASS =
  'w-[220px] min-w-[220px] max-w-[220px] box-border p-0 align-top';

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
