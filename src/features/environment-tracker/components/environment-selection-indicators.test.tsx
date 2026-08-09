import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import {
  EnvironmentKeyDetails,
  type EnvironmentKeySelection,
} from './EnvironmentKeyDetails';
import { EnvironmentMatrix } from './EnvironmentMatrix';
import { EnvironmentStatusLegend } from './EnvironmentStatusLegend';
import { InspectEnvironmentMatrix } from './InspectEnvironmentMatrix';

const environment = {
  createdAt: '2026-08-05T00:00:00.000Z',
  description: null,
  id: 'd63f9ad6-0817-4b8b-ad88-ec19881295b8',
  name: 'Staging',
  projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
  sortOrder: 0,
  updatedAt: '2026-08-05T00:00:00.000Z',
};

const developmentEnvironment = {
  ...environment,
  id: '404dc7b5-0a44-4c9c-ac33-c7d509ab2ac3',
  name: 'Development',
  sortOrder: 1,
};

const firstSource = {
  createdAt: '2026-08-05T00:00:00.000Z',
  environmentId: environment.id,
  id: '4b2cc20c-9360-44b8-85d3-d5f089582d6e',
  lastIssueCode: null,
  lastIssueLine: null,
  lastIssueMessage: null,
  lastObservedModifiedAtMs: null,
  lastObservedSizeBytes: null,
  lastParsedAt: '2026-08-05T00:00:00.000Z',
  lastSuccessfulParseAt: '2026-08-05T00:00:00.000Z',
  parseStatus: 'parsed' as const,
  projectId: environment.projectId,
  relativePath: '.env.playwright.local',
  sortOrder: 0,
  updatedAt: '2026-08-05T00:00:00.000Z',
};

const secondSource = {
  ...firstSource,
  id: '46bac17f-d6e5-4268-96e6-ac2a54c71417',
  relativePath: '.env.security-test.local',
  sortOrder: 1,
};

const sourceDetails = [
  {
    isCommented: false,
    lineNumber: 6,
    relativePath: firstSource.relativePath,
  },
  {
    isCommented: true,
    lineNumber: 12,
    relativePath: secondSource.relativePath,
  },
];

const selection: EnvironmentKeySelection = {
  environment,
  keyName: 'NARRATIVE_LIVE_REPORT_ID',
  sourceDetails,
};

const inspectMatrix = {
  environments: [environment],
  page: 1,
  pageSize: 50,
  rows: [
    {
      cells: [
        {
          sourceDetails,
          state: 'present' as const,
        },
      ],
      keyName: selection.keyName,
    },
    {
      cells: [
        {
          sourceDetails: [sourceDetails[0]],
          state: 'present' as const,
        },
      ],
      keyName: 'SECURITY_EVENT_SECRET',
    },
  ],
  totalItems: 2,
  totalPages: 1,
};

const compareMatrix = {
  environments: [environment, developmentEnvironment],
  page: 1,
  pageSize: 50,
  rows: [
    {
      cells: [
        {
          sourceDetails: [sourceDetails[0]],
          state: 'present' as const,
        },
        {
          sourceDetails: [],
          state: 'absent' as const,
        },
      ],
      keyName: selection.keyName,
    },
    {
      cells: [
        {
          sourceDetails: [],
          state: 'absent' as const,
        },
        {
          sourceDetails: [sourceDetails[0]],
          state: 'present' as const,
        },
      ],
      keyName: 'SUPABASE_PROJECT_REF',
    },
  ],
  totalItems: 2,
  totalPages: 1,
};

function CompareSelectionHarness() {
  const [currentSelection, setCurrentSelection] =
    useState<EnvironmentKeySelection | null>(null);

  return (
    <EnvironmentMatrix
      isRefreshingId={null}
      isReordering={false}
      matrix={compareMatrix}
      onManageSources={vi.fn()}
      onRefresh={vi.fn()}
      onReorder={vi.fn().mockResolvedValue(undefined)}
      onSelect={setCurrentSelection}
      selection={currentSelection}
    />
  );
}

function InspectSelectionHarness() {
  const [currentSelection, setCurrentSelection] =
    useState<EnvironmentKeySelection | null>(null);

  return (
    <InspectEnvironmentMatrix
      environment={environment}
      matrix={inspectMatrix}
      onSelect={setCurrentSelection}
      selection={currentSelection}
      sources={[firstSource, secondSource]}
    />
  );
}

describe('environment selection indicators', () => {
  it('moves the visible definition selection to the latest clicked definition', async () => {
    const user = userEvent.setup();
    const onDefinitionClick = vi.fn();

    renderWithProviders(
      <EnvironmentKeyDetails
        onClose={vi.fn()}
        onDefinitionClick={onDefinitionClick}
        selection={selection}
      />,
    );

    const firstDefinition = screen
      .getByText(firstSource.relativePath)
      .closest('button');
    const secondDefinition = screen
      .getByText(secondSource.relativePath)
      .closest('button');

    expect(firstDefinition).not.toBeNull();
    expect(secondDefinition).not.toBeNull();
    expect(firstDefinition).toHaveAttribute('aria-pressed', 'false');
    expect(secondDefinition).toHaveAttribute('aria-pressed', 'false');

    await user.click(firstDefinition!);

    expect(firstDefinition).toHaveAttribute('aria-pressed', 'true');
    expect(firstDefinition).toHaveAttribute('data-selected', 'true');
    expect(
      document.querySelectorAll('[data-definition-path][data-selected="true"]'),
    ).toHaveLength(1);

    await user.click(secondDefinition!);

    expect(firstDefinition).toHaveAttribute('aria-pressed', 'false');
    expect(firstDefinition).not.toHaveAttribute('data-selected');
    expect(secondDefinition).toHaveAttribute('aria-pressed', 'true');
    expect(secondDefinition).toHaveAttribute('data-selected', 'true');
    expect(
      document.querySelectorAll('[data-definition-path][data-selected="true"]'),
    ).toHaveLength(1);
    expect(onDefinitionClick).toHaveBeenLastCalledWith(
      secondSource.relativePath,
    );
  });

  it('moves the compare-view cell indicator to the newly active cell', async () => {
    const user = userEvent.setup();

    renderWithProviders(<CompareSelectionHarness />);

    const stagingCell = screen.getByRole('button', {
      name: /NARRATIVE_LIVE_REPORT_ID in Staging: Present/,
    });
    const developmentCell = screen.getByRole('button', {
      name: /NARRATIVE_LIVE_REPORT_ID in Development: Absent/,
    });

    await user.click(stagingCell);

    expect(stagingCell).toHaveAttribute('aria-pressed', 'true');
    expect(stagingCell).toHaveAttribute('data-selected', 'true');
    expect(
      document.querySelectorAll('[data-cell-id][data-selected="true"]'),
    ).toHaveLength(1);

    await user.click(developmentCell);

    expect(stagingCell).toHaveAttribute('aria-pressed', 'false');
    expect(stagingCell).not.toHaveAttribute('data-selected');
    expect(developmentCell).toHaveAttribute('aria-pressed', 'true');
    expect(developmentCell).toHaveAttribute('data-selected', 'true');
    expect(
      document.querySelectorAll('[data-cell-id][data-selected="true"]'),
    ).toHaveLength(1);
  });

  it('keeps every compare-view chip color attached to its status after cell selection', async () => {
    const user = userEvent.setup();

    renderWithProviders(<CompareSelectionHarness />);

    await user.click(
      screen.getByRole('button', {
        name: /NARRATIVE_LIVE_REPORT_ID in Development: Absent/,
      }),
    );

    expectChipColor(
      `${selection.keyName}:${environment.id}`,
      'Present',
      'chip--success',
    );
    expectChipColor(
      `${selection.keyName}:${developmentEnvironment.id}`,
      'Absent',
      'chip--default',
    );
    expectChipColor(
      `SUPABASE_PROJECT_REF:${environment.id}`,
      'Absent',
      'chip--default',
    );
    expectChipColor(
      `SUPABASE_PROJECT_REF:${developmentEnvironment.id}`,
      'Present',
      'chip--success',
    );
  });

  it('moves the inspect-view indicator between source cells and keeps headers sticky', async () => {
    const user = userEvent.setup();

    renderWithProviders(<InspectSelectionHarness />);

    expect(screen.getByTestId('inspect-environment-matrix-scroll')).toHaveClass(
      'max-h-[70vh]',
      'overflow-auto',
    );

    const firstCell = screen.getByRole('button', {
      name: 'NARRATIVE_LIVE_REPORT_ID in .env.playwright.local: Active',
    });
    const secondCell = screen.getByRole('button', {
      name: 'NARRATIVE_LIVE_REPORT_ID in .env.security-test.local: Commented',
    });

    await user.click(firstCell);

    expect(firstCell).toHaveAttribute('aria-pressed', 'true');
    expect(firstCell).toHaveAttribute('data-selected', 'true');

    await user.click(secondCell);

    expect(firstCell).toHaveAttribute('aria-pressed', 'false');
    expect(firstCell).not.toHaveAttribute('data-selected');
    expect(secondCell).toHaveAttribute('aria-pressed', 'true');
    expect(secondCell).toHaveAttribute('data-selected', 'true');
    expect(
      document.querySelectorAll('[data-cell-id][data-selected="true"]'),
    ).toHaveLength(1);

    expect(
      screen.getByRole('columnheader', { name: 'Configuration key' }),
    ).toHaveClass('sticky', 'top-0');
  });

  it('keeps inspect-view status colors stable after selecting an absent source cell', async () => {
    const user = userEvent.setup();

    renderWithProviders(<InspectSelectionHarness />);

    await user.click(
      screen.getByRole('button', {
        name: 'SECURITY_EVENT_SECRET in .env.security-test.local: Absent',
      }),
    );

    expectChipColor(
      `SECURITY_EVENT_SECRET:${firstSource.id}`,
      'Active',
      'chip--success',
    );
    expectChipColor(
      `SECURITY_EVENT_SECRET:${secondSource.id}`,
      'Absent',
      'chip--default',
    );
  });

  it('uses explicit, stable colors for every environment status legend item', () => {
    renderWithProviders(<EnvironmentStatusLegend />);

    expect(screen.getByText('Present')).toHaveClass('text-success');
    expect(screen.getByText('Multiple definitions')).toHaveClass(
      'text-warning',
    );
    expect(screen.getByText('Commented only')).toHaveClass('text-muted');
    expect(screen.getByText('Absent')).toHaveClass('text-muted');
    expect(screen.getByText('Source issue')).toHaveClass('text-warning');

    expect(document.querySelectorAll('[data-legend-status]')).toHaveLength(5);
  });
});

function expectChipColor(cellId: string, label: string, colorClass: string) {
  const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
  const chip = cell?.querySelector('[data-slot="chip"]');

  expect(chip).toHaveTextContent(label);
  expect(chip).toHaveClass(colorClass);
}
