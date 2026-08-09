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
});
