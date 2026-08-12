import { renderWithProviders } from '@/test/render';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DevventoryMetricStrip } from './DevventoryMetricStrip';

describe('DevventoryMetricStrip', () => {
  it('renders metric labels and values correctly', () => {
    renderWithProviders(
      <DevventoryMetricStrip
        items={[
          { label: 'Indexed files', value: 42 },
          { label: 'Environments', value: 3 },
        ]}
      />,
    );

    expect(screen.getByText('Indexed files')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Environments')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('applies custom valueClassName without hardcoding text-foreground', () => {
    renderWithProviders(
      <DevventoryMetricStrip
        items={[
          { label: 'Exhausted', value: 6, valueClassName: 'text-danger' },
          { label: 'Reset soon', value: 1, valueClassName: 'text-accent' },
          { label: 'Default item', value: 9 },
        ]}
      />,
    );

    const exhaustedDd = screen.getByText('6');
    expect(exhaustedDd).toHaveClass('text-danger');
    expect(exhaustedDd).not.toHaveClass('text-foreground');

    const resetSoonDd = screen.getByText('1');
    expect(resetSoonDd).toHaveClass('text-accent');
    expect(resetSoonDd).not.toHaveClass('text-foreground');

    const defaultDd = screen.getByText('9');
    expect(defaultDd).toHaveClass('text-foreground');
  });
});
