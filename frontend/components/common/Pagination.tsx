interface PaginationProps {
  page: number;
  hasNext: boolean;
}

export function Pagination({ page, hasNext }: PaginationProps) {
  const previousPage = page - 1;
  const nextPage = page + 1;
  return (
    <div className="mt-8 flex items-center justify-between text-sm">
      <a
        href={previousPage > 0 ? `?page=${previousPage}` : "#"}
        className={`rounded border px-3 py-1 ${
          previousPage <= 0 ? "pointer-events-none border-border opacity-40" : "border-primary/30"
        }`}
        aria-disabled={previousPage <= 0}
      >
        Prev
      </a>
      <span className="text-textSecondary">Page {page}</span>
      <a
        href={hasNext ? `?page=${nextPage}` : "#"}
        className={`rounded border px-3 py-1 ${
          !hasNext ? "pointer-events-none border-border opacity-40" : "border-primary/30"
        }`}
        aria-disabled={!hasNext}
      >
        Next
      </a>
    </div>
  );
}
