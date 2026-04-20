import { useState, useCallback, useRef, useEffect } from 'react';
import { firebaseDB } from '@shared/services/firebaseDataService';
import type { PaginatedResult, PaginationOptions } from '@shared/services/firebaseDataService';
import type { QueryDocumentSnapshot, WhereFilterOp } from '@shared/services/firebaseDataService';

interface UsePaginationOptions {
  collectionName: string;
  pageSize: number;
  orderByField: string;
  orderDirection?: 'asc' | 'desc';
  filters?: { field: string; op: WhereFilterOp; value: unknown }[];
}

interface UsePaginationReturn<T> {
  data: T[];
  page: number;
  hasNext: boolean;
  hasPrev: boolean;
  loading: boolean;
  totalLoaded: number;
  nextPage: () => void;
  prevPage: () => void;
  reset: () => void;
}

export function usePagination<T>(options: UsePaginationOptions): UsePaginationReturn<T> {
  const { collectionName, pageSize, orderByField, orderDirection = 'asc', filters = [] } = options;

  const [data, setData] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);

  // Store cursors for each page: cursors[0] = null (first page), cursors[1] = lastDoc of page 1, etc.
  const cursorsRef = useRef<(QueryDocumentSnapshot | null)[]>([null]);

  // Serialize filters to detect changes
  const filtersKey = JSON.stringify(filters);

  const fetchPage = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const cursor = cursorsRef.current[pageNum - 1] ?? null;

      const result: PaginatedResult<T> = await firebaseDB.getPaginated<T>(collectionName, {
        pageSize,
        orderByField,
        orderDirection,
        cursor,
        filters,
      });

      setData(result.data);
      setHasNext(result.hasMore);
      setPage(pageNum);

      // Store cursor for next page
      if (result.lastDoc && result.hasMore) {
        cursorsRef.current[pageNum] = result.lastDoc;
      }
    } catch (error) {
      console.error(`usePagination error (${collectionName}):`, error);
    } finally {
      setLoading(false);
    }
  }, [collectionName, pageSize, orderByField, orderDirection, filtersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset when filters change
  useEffect(() => {
    cursorsRef.current = [null];
    fetchPage(1);
  }, [fetchPage]);

  const nextPage = useCallback(() => {
    if (hasNext) fetchPage(page + 1);
  }, [hasNext, page, fetchPage]);

  const prevPage = useCallback(() => {
    if (page > 1) fetchPage(page - 1);
  }, [page, fetchPage]);

  const reset = useCallback(() => {
    cursorsRef.current = [null];
    fetchPage(1);
  }, [fetchPage]);

  return {
    data,
    page,
    hasNext,
    hasPrev: page > 1,
    loading,
    totalLoaded: data.length,
    nextPage,
    prevPage,
    reset,
  };
}
