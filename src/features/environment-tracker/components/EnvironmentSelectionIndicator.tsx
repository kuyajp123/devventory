import { memo } from 'react';

export const EnvironmentSelectionIndicator = memo(
  function EnvironmentSelectionIndicator({
    isSelected,
  }: {
    isSelected: boolean;
  }) {
    if (!isSelected) {
      return null;
    }

    return (
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-1 z-20 rounded-[inherit] border-2 border-accent ring-1 ring-inset ring-accent/60"
        data-selection-indicator="true"
      />
    );
  },
);
