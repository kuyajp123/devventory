import { describe, expect, it } from 'vitest';
import { formatFileSize, inventoryPageSchema } from './file-inventory';

describe('file inventory contracts', () => {
  it('formats bounded file metadata sizes without reading file data', () => {
    expect(formatFileSize(900)).toBe('900 B');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(10 * 1024 * 1024)).toBe('10 MB');
  });

  it('rejects an unbounded inventory page response', () => {
    expect(() =>
      inventoryPageSchema.parse({
        items: [],
        page: 1,
        pageSize: 101,
        recentScans: [],
        totalItems: 0,
        totalPages: 0,
        watchedLocations: [],
      }),
    ).toThrow();
  });
});
