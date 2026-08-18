/**
 * Cleans and formats raw release notes from semantic-release / Tauri updater:
 * - Strips redundant leading markdown release header (e.g. `## [1.1.0](...) (2026-08-16)` or `## 1.1.0`)
 * - Trims excess leading/trailing whitespace
 * - If only the header was present (leaving no notes body), returns a clean fallback
 *   (e.g., "Includes bug fixes and performance improvements.")
 */
export function formatReleaseNotes(rawNotes?: string | null): string {
  if (!rawNotes || !rawNotes.trim()) {
    return 'Includes bug fixes and performance improvements.';
  }

  // Remove leading markdown release headers like:
  // `## [1.1.0](https://github.com/.../compare/...) (2026-08-16)`
  // `## 1.1.0 (2026-08-16)`
  // `## [1.1.0]` or `## 1.1.0`
  const cleaned = rawNotes
    .replace(
      /^##\s+(\[[^\]]+\]\([^)]+\)|v?[0-9.]+)(\s*\(\d{4}-\d{2}-\d{2}\))?\s*/i,
      '',
    )
    .trim();

  if (!cleaned) {
    return 'Includes bug fixes and performance improvements.';
  }

  return cleaned;
}
