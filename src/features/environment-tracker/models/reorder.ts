import { arrayMove } from '@dnd-kit/sortable';

export function reorderIds(
  ids: readonly string[],
  activeId: string,
  overId: string | null,
): string[] | null {
  if (!overId || activeId === overId) return null;
  const oldIndex = ids.indexOf(activeId);
  const newIndex = ids.indexOf(overId);
  if (oldIndex < 0 || newIndex < 0) return null;
  return arrayMove([...ids], oldIndex, newIndex);
}
