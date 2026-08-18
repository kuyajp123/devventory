import { describe, expect, it } from 'vitest';
import { formatReleaseNotes } from './format-release-notes';

describe('formatReleaseNotes', () => {
  it('returns fallback message when notes are null, undefined, or empty', () => {
    expect(formatReleaseNotes(null)).toBe(
      'Includes bug fixes and performance improvements.',
    );
    expect(formatReleaseNotes(undefined)).toBe(
      'Includes bug fixes and performance improvements.',
    );
    expect(formatReleaseNotes('')).toBe(
      'Includes bug fixes and performance improvements.',
    );
    expect(formatReleaseNotes('   ')).toBe(
      'Includes bug fixes and performance improvements.',
    );
  });

  it('strips redundant release header and returns fallback if no body remains', () => {
    const raw =
      '## [1.1.0](https://github.com/kuyajp123/devventory/compare/v1.0.1...v1.1.0) (2026-08-16)';
    expect(formatReleaseNotes(raw)).toBe(
      'Includes bug fixes and performance improvements.',
    );
  });

  it('strips redundant release header with plain version and date', () => {
    const raw = '## 1.1.0 (2026-08-16)';
    expect(formatReleaseNotes(raw)).toBe(
      'Includes bug fixes and performance improvements.',
    );
  });

  it('strips redundant release header and preserves actual feature and fix notes', () => {
    const raw = `## [1.1.0](https://github.com/kuyajp123/devventory/compare/v1.0.1...v1.1.0) (2026-08-16)

### Bug Fixes

* **quick-access:** resolve quota time formatting ([#20](https://github.com/kuyajp123/devventory/issues/20))
* **credential-vault:** add custom icon image preview

### Features

* add target cell redirect in credential vault`;

    const expected = `### Bug Fixes

* **quick-access:** resolve quota time formatting ([#20](https://github.com/kuyajp123/devventory/issues/20))
* **credential-vault:** add custom icon image preview

### Features

* add target cell redirect in credential vault`;

    expect(formatReleaseNotes(raw)).toBe(expected);
  });

  it('preserves clean release notes that do not have a markdown header', () => {
    const raw =
      '- Fixed reset time calculation\n- Added image preview to credential sources';
    expect(formatReleaseNotes(raw)).toBe(raw);
  });
});
