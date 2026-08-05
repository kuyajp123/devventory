import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import {
  EnvironmentKeyDetails,
  type EnvironmentKeySelection,
} from './EnvironmentKeyDetails';
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

const selection: EnvironmentKeySelection = {
  environment,
  keyName: 'NARRATIVE_LIVE_REPORT_ID',
  sourceDetails: [
    {
      isCommented: false,
      lineNumber: 6,
      relativePath: '.env.playwright.local',
    },
  ],
};

describe('environment selection indicators', () => {
  it('visibly selects a definition after it is clicked', async () => {
    const user = userEvent.setup();
    const onDefinitionClick = vi.fn();

    renderWithProviders(
      <EnvironmentKeyDetails
        onClose={vi.fn()}
        onDefinitionClick={onDefinitionClick}
        selection={selection}
      />,
    );

    const definition = screen
      .getByText('.env.playwright.local')
      .closest('button');

    expect(definition).not.toBeNull();
    expect(definition).toHaveAttribute('aria-pressed', 'false');

    await user.click(definition!);

    expect(definition).toHaveAttribute('aria-pressed', 'true');
    expect(definition).toHaveAttribute('data-selected', 'true');
    expect(definition).toHaveClass('ring-2', 'ring-inset', 'ring-accent');
    expect(onDefinitionClick).toHaveBeenCalledWith('.env.playwright.local');
  });

  it('keeps the inspect header sticky and marks the selected source cell', () => {
    const source = {
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

    renderWithProviders(
      <InspectEnvironmentMatrix
        environment={environment}
        matrix={{
          environments: [environment],
          page: 1,
          pageSize: 50,
          rows: [
            {
              cells: [
                {
                  sourceDetails: selection.sourceDetails,
                  state: 'present',
                },
              ],
              keyName: selection.keyName,
            },
          ],
          totalItems: 1,
          totalPages: 1,
        }}
        onSelect={vi.fn()}
        selection={{
          ...selection,
          selectedSourcePath: '.env.playwright.local',
        }}
        sources={[source]}
      />,
    );

    expect(screen.getByTestId('inspect-environment-matrix-scroll')).toHaveClass(
      'max-h-[70vh]',
      'overflow-auto',
    );

    const selectedCell = screen.getByRole('button', {
      name: 'NARRATIVE_LIVE_REPORT_ID in .env.playwright.local: Active',
    });

    expect(selectedCell).toHaveAttribute('aria-pressed', 'true');
    expect(selectedCell).toHaveAttribute('data-selected', 'true');
    expect(selectedCell).toHaveClass('ring-2', 'ring-inset', 'ring-accent');

    expect(
      screen.getByRole('columnheader', { name: 'Configuration key' }),
    ).toHaveClass('sticky', 'top-0');
  });
});
