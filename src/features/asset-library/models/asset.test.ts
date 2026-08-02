import { describe, expect, it } from 'vitest';
import { assetImportFormSchema, parseTags } from './asset';

describe('asset import form', () => {
  it('requires a filename only for the rename collision choice', () => {
    const result = assetImportFormSchema.safeParse({
      collision: 'rename',
      destination: 'assets',
      favorite: false,
      filename: '',
      note: '',
      tagsText: '',
    });
    expect(result.success).toBe(false);
  });

  it('normalizes duplicate comma-separated tags for the command contract', () => {
    expect(parseTags('Brand, approved, brand')).toEqual(['Brand', 'approved']);
  });
});
