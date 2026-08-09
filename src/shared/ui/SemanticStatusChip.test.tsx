import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SemanticStatusChip } from './SemanticStatusChip';

describe('SemanticStatusChip', () => {
  it.each([
    ['success', 'Healthy', 'chip--success', 'bg-success/15', 'text-success'],
    [
      'warning',
      'Needs review',
      'chip--warning',
      'bg-warning/15',
      'text-warning',
    ],
    ['danger', 'Failed', 'chip--danger', 'bg-danger/15', 'text-danger'],
    ['accent', 'Running', 'chip--accent', 'bg-accent/15', 'text-accent'],
    ['neutral', 'Unknown', 'chip--default', 'bg-default/40', 'text-muted'],
  ] as const)(
    'keeps the %s tone attached to its label',
    (tone, label, heroColorClass, backgroundClass, textClass) => {
      render(<SemanticStatusChip label={label} tone={tone} />);

      const chip = screen.getByText(label).closest('[data-slot="chip"]');
      expect(chip).toHaveAttribute('data-status-tone', tone);
      expect(chip).toHaveClass(heroColorClass, backgroundClass, textClass);
    },
  );
});
