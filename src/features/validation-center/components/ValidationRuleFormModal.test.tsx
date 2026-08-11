import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { Environment } from '@/features/environment-tracker';
import type { ValidationRule } from '../models/validation';
import { ValidationRuleFormModal } from './ValidationRuleFormModal';

describe('ValidationRuleFormModal', () => {
  it('resets every field when switching between create and edit sessions', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    const { rerender } = renderWithProviders(
      <ValidationRuleFormModal
        environments={[environment]}
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        rule={null}
      />,
    );

    await user.type(screen.getByLabelText('Environment key'), 'UNSAVED_KEY');

    rerender(
      <ValidationRuleFormModal
        environments={[environment]}
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        rule={rule}
      />,
    );

    expect(screen.getByLabelText('Environment key')).toHaveValue('API_URL');
    expect(screen.getByLabelText('Description (optional)')).toHaveValue(
      'Public API endpoint',
    );
    expect(screen.getByRole('checkbox', { name: 'Development' })).toBeChecked();
    expect(screen.getByRole('switch', { name: /^Rule enabled/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Save rule' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Save rule' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        description: 'Public API endpoint',
        enabled: true,
        environmentIds: [environment.id],
        keyName: 'API_URL',
        ruleType: 'optional',
        severity: 'warning',
      }),
    );

    rerender(
      <ValidationRuleFormModal
        environments={[environment]}
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        rule={{
          ...rule,
          description: null,
          enabled: false,
          keyName: 'DATABASE_URL',
          ruleType: 'forbidden',
          severity: 'info',
        }}
      />,
    );

    expect(screen.getByLabelText('Environment key')).toHaveValue(
      'DATABASE_URL',
    );
    expect(screen.getByLabelText('Description (optional)')).toHaveValue('');
    expect(
      screen.getByRole('switch', { name: /^Rule enabled/ }),
    ).not.toBeChecked();

    rerender(
      <ValidationRuleFormModal
        environments={[environment]}
        isOpen={false}
        isSaving={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        rule={null}
      />,
    );
    rerender(
      <ValidationRuleFormModal
        environments={[environment]}
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        rule={null}
      />,
    );

    expect(screen.getByLabelText('Environment key')).toHaveValue('');
    expect(
      screen.getByRole('checkbox', { name: 'Development' }),
    ).not.toBeChecked();
  });
});

const environment: Environment = {
  createdAt: '2026-08-08T00:00:00.000Z',
  description: null,
  id: 'd63f9ad6-0817-4b8b-ad88-ec19881295b8',
  name: 'Development',
  projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
  sortOrder: 0,
  updatedAt: '2026-08-08T00:00:00.000Z',
};

const rule: ValidationRule = {
  createdAt: '2026-08-08T00:00:00.000Z',
  description: 'Public API endpoint',
  enabled: true,
  environmentIds: [environment.id],
  id: 'c4373b86-1c32-4f96-a315-f5d17089966f',
  keyName: 'API_URL',
  projectId: environment.projectId,
  ruleType: 'optional',
  severity: 'warning',
  sortOrder: 0,
  updatedAt: '2026-08-08T00:00:00.000Z',
};
