import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type {
  Environment,
  EnvironmentMatrixPage,
  EnvironmentSource,
} from '../models/environment';
import { InspectEnvironmentMatrix } from './InspectEnvironmentMatrix';
import { createEnvironmentMatrixSelectionStore } from './environment-matrix-selection-context';

describe('InspectEnvironmentMatrix', () => {
  it('rebuilds the table collection when configured sources are added and removed', () => {
    const sources = [
      sourceResponse('source-1', 'Backend/.env', 0),
      sourceResponse('source-2', 'Backend/.env.staging', 1),
      sourceResponse('source-3', 'Frontend/.env.staging', 2),
    ];
    const matrix = matrixResponse();
    const { rerender } = renderWithProviders(
      <InspectEnvironmentMatrix
        environment={environment}
        matrix={matrix}
        onSelect={vi.fn()}
        selectionStore={createEnvironmentMatrixSelectionStore()}
        sources={sources.slice(0, 2)}
      />,
    );

    expect(screen.getAllByRole('columnheader')).toHaveLength(3);

    rerender(
      <InspectEnvironmentMatrix
        environment={environment}
        matrix={matrix}
        onSelect={vi.fn()}
        selectionStore={createEnvironmentMatrixSelectionStore()}
        sources={sources}
      />,
    );

    expect(screen.getAllByRole('columnheader')).toHaveLength(4);
    expect(
      screen.getByRole('columnheader', {
        name: /Frontend\/.env\.staging/,
      }),
    ).toBeVisible();

    rerender(
      <InspectEnvironmentMatrix
        environment={environment}
        matrix={matrix}
        onSelect={vi.fn()}
        selectionStore={createEnvironmentMatrixSelectionStore()}
        sources={sources.slice(0, 2)}
      />,
    );

    expect(screen.getAllByRole('columnheader')).toHaveLength(3);
    expect(
      screen.queryByRole('columnheader', {
        name: /Frontend\/.env\.staging/,
      }),
    ).not.toBeInTheDocument();
  });
});

const environment: Environment = {
  createdAt: '2026-08-05T00:00:00.000Z',
  description: 'Staging configuration',
  id: 'd63f9ad6-0817-4b8b-ad88-ec19881295b8',
  name: 'Staging',
  projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
  sortOrder: 0,
  updatedAt: '2026-08-05T00:00:00.000Z',
};

function sourceResponse(
  id: string,
  relativePath: string,
  sortOrder: number,
): EnvironmentSource {
  return {
    createdAt: '2026-08-05T00:00:00.000Z',
    environmentId: environment.id,
    id,
    lastIssueCode: null,
    lastIssueLine: null,
    lastIssueMessage: null,
    lastObservedModifiedAtMs: null,
    lastObservedSizeBytes: null,
    lastParsedAt: '2026-08-05T00:00:00.000Z',
    lastSuccessfulParseAt: '2026-08-05T00:00:00.000Z',
    parseStatus: 'parsed',
    projectId: environment.projectId,
    relativePath,
    sortOrder,
    updatedAt: '2026-08-05T00:00:00.000Z',
  };
}

function matrixResponse(): EnvironmentMatrixPage {
  return {
    environments: [environment],
    page: 1,
    pageSize: 50,
    rows: [
      {
        cells: [
          {
            sourceDetails: [
              {
                isCommented: false,
                lineNumber: 1,
                relativePath: 'Backend/.env',
              },
            ],
            state: 'present',
            validation: { openIssues: [], rules: [] },
          },
        ],
        keyName: 'APP_BASE_URL',
      },
    ],
    totalItems: 1,
    totalPages: 1,
  };
}
