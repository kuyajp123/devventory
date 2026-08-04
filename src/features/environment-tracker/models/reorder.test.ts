import { describe, expect, it } from 'vitest';
import { reorderIds } from './reorder';

describe('reorderIds', () => {
  it('moves one persisted identifier without duplicating values', () => {
    expect(
      reorderIds(['local', 'staging', 'production'], 'production', 'local'),
    ).toEqual(['production', 'local', 'staging']);
  });

  it('ignores invalid and no-op drops', () => {
    expect(reorderIds(['local'], 'local', 'local')).toBeNull();
    expect(reorderIds(['local'], 'missing', 'local')).toBeNull();
    expect(reorderIds(['local'], 'local', null)).toBeNull();
  });
});
