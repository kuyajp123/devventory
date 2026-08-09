export const fileInventoryProjectKeys = {
  all: ['file-inventory'] as const,
  project: (projectId: string) => ['file-inventory', projectId] as const,
};
