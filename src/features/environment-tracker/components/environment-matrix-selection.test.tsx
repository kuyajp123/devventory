import { act, screen } from '@testing-library/react';
import { memo } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { EnvironmentKeySelection } from './EnvironmentKeyDetails';
import { EnvironmentMatrixSelectionProvider } from './environment-matrix-selection';
import {
  createEnvironmentMatrixSelectionStore,
  useEnvironmentMatrixCellSelection,
} from './environment-matrix-selection-context';

const environment = {
  createdAt: '2026-08-05T00:00:00.000Z',
  description: null,
  id: 'd63f9ad6-0817-4b8b-ad88-ec19881295b8',
  name: 'Staging',
  projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
  sortOrder: 0,
  updatedAt: '2026-08-05T00:00:00.000Z',
};

const renderCounts = new Map<string, number>();

const CellProbe = memo(function CellProbe({ keyName }: { keyName: string }) {
  const isSelected = useEnvironmentMatrixCellSelection(keyName, environment.id);
  renderCounts.set(keyName, (renderCounts.get(keyName) ?? 0) + 1);

  return <output data-selected={isSelected}>{keyName}</output>;
});

describe('environment matrix selection store', () => {
  it('does not rerender unrelated cells when the active cell changes', () => {
    renderCounts.clear();
    const store = createEnvironmentMatrixSelectionStore();
    const keys = Array.from({ length: 100 }, (_, index) => `KEY_${index}`);

    renderWithProviders(
      <EnvironmentMatrixSelectionProvider store={store}>
        {keys.map((keyName) => (
          <CellProbe key={keyName} keyName={keyName} />
        ))}
      </EnvironmentMatrixSelectionProvider>,
    );

    act(() => store.setSelection(selectionFor('KEY_10')));

    expect(screen.getByText('KEY_10')).toHaveAttribute('data-selected', 'true');
    expect(renderCounts.get('KEY_10')).toBe(2);
    expect(renderCounts.get('KEY_50')).toBe(1);

    act(() => store.setSelection(selectionFor('KEY_20')));

    expect(screen.getByText('KEY_10')).toHaveAttribute(
      'data-selected',
      'false',
    );
    expect(screen.getByText('KEY_20')).toHaveAttribute('data-selected', 'true');
    expect(renderCounts.get('KEY_10')).toBe(3);
    expect(renderCounts.get('KEY_20')).toBe(2);
    expect(renderCounts.get('KEY_50')).toBe(1);
  });
});

function selectionFor(keyName: string): EnvironmentKeySelection {
  return {
    environment,
    keyName,
    sourceDetails: [],
    validation: { openIssues: [], rules: [] },
  };
}
