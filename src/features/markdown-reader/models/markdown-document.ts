import { z } from 'zod';

export const markdownDocumentSchema = z.object({
  fileName: z.string().min(1),
  path: z.string().min(1),
  content: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  modifiedAtMs: z.number().int().nullable(),
});

export type MarkdownDocument = z.infer<typeof markdownDocumentSchema>;
