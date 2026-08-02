import { IconFileOff, IconFiles } from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { formatFileSize, type IndexedFile } from '../models/file-inventory';

interface InventoryTableProps {
  files: IndexedFile[];
  hasFilters: boolean;
}

export function InventoryTable({ files, hasFilters }: InventoryTableProps) {
  if (files.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-divider bg-surface p-8 text-center">
        <IconFileOff
          aria-hidden="true"
          className="mx-auto text-muted"
          size={ICON_SIZE.emptyState}
          stroke={ICON_STROKE}
        />
        <h2 className="mt-4 text-lg font-semibold">
          {hasFilters ? 'No files match these filters' : 'No indexed files yet'}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {hasFilters
            ? 'Adjust the filters or reset them to see more files.'
            : 'Run a project scan to build the local metadata inventory.'}
        </p>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="inventory-results-heading"
      className="overflow-hidden rounded-2xl border border-divider bg-surface"
    >
      <h2 className="sr-only" id="inventory-results-heading">
        Indexed files
      </h2>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-secondary text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium" scope="col">
                File
              </th>
              <th className="px-4 py-3 font-medium" scope="col">
                Category
              </th>
              <th className="px-4 py-3 font-medium" scope="col">
                Size
              </th>
              <th className="px-4 py-3 font-medium" scope="col">
                Modified
              </th>
              <th className="px-4 py-3 font-medium" scope="col">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {files.map((file) => (
              <tr key={file.id}>
                <td className="max-w-md px-4 py-3">
                  <p className="truncate font-medium">{file.name}</p>
                  <p className="truncate font-mono text-xs text-muted">
                    {file.relativePath}
                  </p>
                </td>
                <td className="px-4 py-3 capitalize">{file.category}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {formatFileSize(file.sizeBytes)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">
                  {formatModified(file.modifiedAtMs)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={file.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-divider md:hidden">
        {files.map((file) => (
          <li className="space-y-3 p-4" key={file.id}>
            <div className="flex items-start gap-3">
              <IconFiles
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-accent"
                size={ICON_SIZE.navigation}
                stroke={ICON_STROKE}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{file.name}</p>
                <p className="break-all font-mono text-xs text-muted">
                  {file.relativePath}
                </p>
              </div>
              <StatusBadge status={file.status} />
            </div>
            <p className="text-xs capitalize text-muted">
              {file.category} · {formatFileSize(file.sizeBytes)} ·{' '}
              {formatModified(file.modifiedAtMs)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusBadge({ status }: { status: IndexedFile['status'] }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
        status === 'active'
          ? 'bg-success/10 text-success'
          : 'bg-warning/10 text-warning'
      }`}
    >
      {status === 'active' ? 'Active' : 'Missing'}
    </span>
  );
}

function formatModified(value: number | null): string {
  if (value === null) return 'Unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
