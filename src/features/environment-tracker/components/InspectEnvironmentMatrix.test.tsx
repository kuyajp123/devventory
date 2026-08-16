import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type {
  Environment,
  EnvironmentInspectableSource,
  EnvironmentMatrixPage,
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

  it('shows custom sources without fabricated file paths, parser health, or line numbers', () => {
    const sourceId = '39f15e31-e7b1-47db-b027-c8707551d1d2';
    const matrix = matrixResponse();
    matrix.rows[0].cells[0].sourceDetails = [
      {
        isCommented: false,
        lineNumber: null,
        origin: 'custom',
        relativePath: null,
        sourceId,
        sourceName: 'Credential registry',
      },
    ];

    renderWithProviders(
      <InspectEnvironmentMatrix
        environment={environment}
        matrix={matrix}
        onSelect={vi.fn()}
        selectionStore={createEnvironmentMatrixSelectionStore()}
        sources={[
          {
            id: sourceId,
            label: 'Credential registry',
            origin: 'custom',
            parseStatus: 'parsed',
            sortOrder: 0,
          },
        ]}
      />,
    );

    expect(screen.getByText('Credential registry')).toBeVisible();
    expect(screen.getByText('Custom metadata source')).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: 'APP_BASE_URL in Credential registry: Present',
      }),
    ).toBeVisible();
    expect(screen.queryByText(/line 1/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/parsed/i)).not.toBeInTheDocument();
  });

  it('carries custom source identity when the selected key is absent', () => {
    const sourceId = '39f15e31-e7b1-47db-b027-c8707551d1d2';
    const matrix = matrixResponse();
    matrix.rows[0].cells[0].sourceDetails = [];
    const onSelect = vi.fn();

    renderWithProviders(
      <InspectEnvironmentMatrix
        environment={environment}
        matrix={matrix}
        onSelect={onSelect}
        selectionStore={createEnvironmentMatrixSelectionStore()}
        sources={[
          {
            id: sourceId,
            label: 'Credential registry',
            origin: 'custom',
            parseStatus: 'parsed',
            sortOrder: 0,
          },
        ]}
      />,
    );

    screen
      .getByRole('button', {
        name: 'APP_BASE_URL in Credential registry: Absent',
      })
      .click();

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedSource: {
          id: sourceId,
          label: 'Credential registry',
          origin: 'custom',
        },
      }),
    );
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
): EnvironmentInspectableSource {
  return {
    id,
    label: relativePath,
    origin: 'file',
    parseStatus: 'parsed',
    sortOrder,
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
                origin: 'file',
                relativePath: 'Backend/.env',
                sourceId: '4b2cc20c-9360-44b8-85d3-d5f089582d6e',
                sourceName: 'Backend/.env',
              },
            ],
            state: 'present',
            validation: { ignoredIssues: [], openIssues: [], rules: [] },
          },
        ],
        keyName: 'APP_BASE_URL',
      },
    ],
    totalItems: 1,
    totalPages: 1,
  };
}
