import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type {
  EnvironmentMatrixValidationIssue,
  EnvironmentMatrixValidationRule,
} from '../models/environment';
import { EnvironmentValidationDetails } from './EnvironmentValidationDetails';

describe('EnvironmentValidationDetails', () => {
  it('shows every open finding and applicable rule instead of only the highest severity', () => {
    renderWithProviders(
      <EnvironmentValidationDetails
        validation={{
          openIssues: [
            issue({
              id: '4ce13759-a72a-4595-8133-2d7100f42f01',
              message: 'Required key is missing.',
              severity: 'error',
            }),
            issue({
              id: 'a4a7ff22-8d77-4f06-af26-c6dcdb8d1c15',
              lineNumber: 12,
              message: 'Key casing differs from the configured rule.',
              severity: 'warning',
              sourcePath: '.env.production',
            }),
          ],
          rules: [rule()],
        }}
      />,
    );

    expect(screen.getByText('2 open')).toBeVisible();
    expect(screen.getByText('Required key is missing.')).toBeVisible();
    expect(
      screen.getByText('Key casing differs from the configured rule.'),
    ).toBeVisible();
    expect(screen.getByText('.env.production:12')).toBeVisible();
    expect(screen.getByText('Production database connection')).toBeVisible();
  });

  it('uses a compact neutral explanation when the cell has no active issue', () => {
    renderWithProviders(
      <EnvironmentValidationDetails
        validation={{ openIssues: [], rules: [] }}
      />,
    );

    expect(
      screen.getByText(
        'No open validation issues target this key and environment.',
      ),
    ).toBeVisible();
    expect(
      screen.getByText('No enabled rule targets this cell.'),
    ).toBeVisible();
  });
});

const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';
const environmentId = 'd63f9ad6-0817-4b8b-ad88-ec19881295b8';

function issue(
  overrides: Partial<EnvironmentMatrixValidationIssue>,
): EnvironmentMatrixValidationIssue {
  return {
    environmentId,
    environmentName: 'Production',
    firstSeenAt: '2026-08-08T00:00:00.000Z',
    id: '4ce13759-a72a-4595-8133-2d7100f42f01',
    issueType: 'required_missing',
    keyName: 'DATABASE_URL',
    lastSeenAt: '2026-08-08T00:00:00.000Z',
    lineNumber: null,
    message: 'Required key is missing.',
    observedName: null,
    projectId,
    resolvedAt: null,
    ruleId: '6ce45b9b-83fe-48f1-a744-17739bfbd7fd',
    severity: 'error',
    sourcePath: null,
    status: 'open',
    updatedAt: '2026-08-08T00:00:00.000Z',
    ...overrides,
  };
}

function rule(): EnvironmentMatrixValidationRule {
  return {
    createdAt: '2026-08-08T00:00:00.000Z',
    description: 'Production database connection',
    enabled: true,
    environmentIds: [environmentId],
    id: '6ce45b9b-83fe-48f1-a744-17739bfbd7fd',
    keyName: 'DATABASE_URL',
    projectId,
    ruleType: 'required',
    severity: 'error',
    sortOrder: 0,
    updatedAt: '2026-08-08T00:00:00.000Z',
  };
}
