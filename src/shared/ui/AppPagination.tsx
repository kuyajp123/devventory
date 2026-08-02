import { Pagination } from '@heroui/react';

interface AppPaginationProps {
  ariaLabel: string;
  onPageChange: (page: number) => void;
  page: number;
  totalPages: number;
}

export function AppPagination({
  ariaLabel,
  onPageChange,
  page,
  totalPages,
}: AppPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <Pagination aria-label={ariaLabel} className="justify-center" size="sm">
      <Pagination.Summary>
        Page {page} of {totalPages}
      </Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous
            isDisabled={page <= 1}
            onPress={() => onPageChange(page - 1)}
          >
            <Pagination.PreviousIcon />
            <span>Previous</span>
          </Pagination.Previous>
        </Pagination.Item>
        {paginationEntries(page, totalPages).map((entry) =>
          typeof entry === 'number' ? (
            <Pagination.Item key={entry}>
              <Pagination.Link
                isActive={entry === page}
                onPress={() => onPageChange(entry)}
              >
                {entry}
              </Pagination.Link>
            </Pagination.Item>
          ) : (
            <Pagination.Item key={entry}>
              <Pagination.Ellipsis />
            </Pagination.Item>
          ),
        )}
        <Pagination.Item>
          <Pagination.Next
            isDisabled={page >= totalPages}
            onPress={() => onPageChange(page + 1)}
          >
            <span>Next</span>
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}

type PaginationEntry = number | `ellipsis-${number}`;

function paginationEntries(
  page: number,
  totalPages: number,
): PaginationEntry[] {
  const visiblePages = new Set([
    1,
    totalPages,
    Math.max(1, page - 1),
    page,
    Math.min(totalPages, page + 1),
  ]);
  const sorted = [...visiblePages].sort((left, right) => left - right);
  const entries: PaginationEntry[] = [];

  for (const visiblePage of sorted) {
    const previous = entries[entries.length - 1];
    if (typeof previous === 'number' && visiblePage - previous > 1) {
      entries.push(`ellipsis-${previous}`);
    }
    entries.push(visiblePage);
  }

  return entries;
}
