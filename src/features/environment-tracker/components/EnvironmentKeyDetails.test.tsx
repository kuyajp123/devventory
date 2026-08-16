import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { EnvironmentKeySelection } from './EnvironmentKeyDetails';
import { EnvironmentKeyDetails } from './EnvironmentKeyDetails';

describe('EnvironmentKeyDetails custom definitions', () => {
  it('identifies an absent custom source without inventing file metadata', () => {
    renderWithProviders(
      <EnvironmentKeyDetails onClose={vi.fn()} selection={selection([])} />,
    );

    expect(screen.getByText(/Staging.*Credential registry/)).toBeVisible();
    expect(screen.getByText('Absent')).toBeVisible();
    expect(screen.queryByText(/line unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/parse/i)).not.toBeInTheDocument();
  });

  it('labels a custom occurrence Present instead of Active', () => {
    renderWithProviders(
      <EnvironmentKeyDetails
        onClose={vi.fn()}
        selection={selection([
          {
            isCommented: false,
            lineNumber: null,
            origin: 'custom',
            relativePath: null,
            sourceId: SOURCE_ID,
            sourceName: 'Credential registry',
          },
        ])}
      />,
    );

    expect(screen.getAllByText('Present').length).toBeGreaterThan(0);
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
    expect(screen.getByText('Custom metadata source')).toBeVisible();
  });
});

const SOURCE_ID = '39f15e31-e7b1-47db-b027-c8707551d1d2';

function selection(
  sourceDetails: EnvironmentKeySelection['sourceDetails'],
): EnvironmentKeySelection {
  return {
    environment: {
      createdAt: '2026-08-05T00:00:00.000Z',
      description: null,
      id: 'd63f9ad6-0817-4b8b-ad88-ec19881295b8',
      name: 'Staging',
      projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
      sortOrder: 0,
      updatedAt: '2026-08-05T00:00:00.000Z',
    },
    keyName: 'signing-key.p12',
    selectedSource: {
      id: SOURCE_ID,
      label: 'Credential registry',
      origin: 'custom',
    },
    selectedSourcePath: SOURCE_ID,
    sourceDetails,
    validation: { ignoredIssues: [], openIssues: [], rules: [] },
  };
}
