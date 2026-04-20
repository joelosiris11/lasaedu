import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface PaginationProps {
  page: number;
  hasNext: boolean;
  hasPrev: boolean;
  loading?: boolean;
  onNext: () => void;
  onPrev: () => void;
  itemCount?: number;
  className?: string;
}

export function Pagination({
  page,
  hasNext,
  hasPrev,
  loading,
  onNext,
  onPrev,
  itemCount,
  className = '',
}: PaginationProps) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50/50 ${className}`}>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
        ) : (
          <>
            {itemCount !== undefined && (
              <span>{itemCount} resultado{itemCount !== 1 ? 's' : ''}</span>
            )}
            <span className="text-gray-400">-</span>
            <span>Pagina {page}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev || loading}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          aria-label="Pagina anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext || loading}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          aria-label="Pagina siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
