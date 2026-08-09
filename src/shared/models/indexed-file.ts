import { z } from 'zod';

export const fileCategorySchema = z.enum([
  'source',
  'document',
  'image',
  'audio',
  'video',
  'archive',
  'font',
  'configuration',
  'other',
]);
export type FileCategory = z.infer<typeof fileCategorySchema>;

export const fileCategoryOptions: ReadonlyArray<{
  label: string;
  value: FileCategory;
}> = [
  { label: 'Source', value: 'source' },
  { label: 'Documents', value: 'document' },
  { label: 'Images', value: 'image' },
  { label: 'Audio', value: 'audio' },
  { label: 'Video', value: 'video' },
  { label: 'Archives', value: 'archive' },
  { label: 'Fonts', value: 'font' },
  { label: 'Configuration', value: 'configuration' },
  { label: 'Other', value: 'other' },
];

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}
