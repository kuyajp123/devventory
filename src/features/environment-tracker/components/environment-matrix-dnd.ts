import type { Modifier } from '@dnd-kit/core';

export const restrictToHorizontalAxis: Modifier = ({ transform }) => ({
  ...transform,
  y: 0,
});

export function createRestrictToEnvironmentHeaderBounds(
  getBounds: () => { left: number; right: number } | null,
): Modifier {
  return ({ transform, draggingNodeRect }) => {
    if (!draggingNodeRect) {
      return {
        ...transform,
        y: 0,
      };
    }

    const bounds = getBounds();

    if (!bounds) {
      return {
        ...transform,
        y: 0,
      };
    }

    let { x } = transform;

    const projectedLeft = draggingNodeRect.left + x;
    const projectedRight = draggingNodeRect.right + x;

    if (projectedLeft < bounds.left) {
      x += bounds.left - projectedLeft;
    }

    if (projectedRight > bounds.right) {
      x -= projectedRight - bounds.right;
    }

    return {
      ...transform,
      x,
      y: 0,
    };
  };
}

export function getEnvironmentHeaderBounds(
  headerElement: Element | null,
): { left: number; right: number } | null {
  if (!headerElement) {
    return null;
  }

  const columns = headerElement.querySelectorAll('[data-slot="table-column"]');

  if (columns.length < 2) {
    return null;
  }

  const firstEnvironmentColumn = columns[1] as HTMLElement;
  const lastEnvironmentColumn = columns[columns.length - 1] as HTMLElement;

  return {
    left: firstEnvironmentColumn.getBoundingClientRect().left,
    right: lastEnvironmentColumn.getBoundingClientRect().right,
  };
}
