/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/**
 * Custom hook for fetching and managing projections
 */
import { useState, useEffect, useCallback } from 'react';
import { listProjections, deleteProjection as apiDeleteProjection } from '@/lib/api/projections';
import type { ProjectionListItem, PaginatedProjections } from '@/types/projection';

interface UseProjectionsOptions {
  page?: number;
  limit?: number;
}

interface UseProjectionsReturn {
  projections: ProjectionListItem[];
  pagination: PaginatedProjections['pagination'] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  deleteProjection: (id: string) => Promise<boolean>;
}

export function useProjections(options: UseProjectionsOptions = {}): UseProjectionsReturn {
  const { page = 1, limit = 20 } = options;
  const [projections, setProjections] = useState<ProjectionListItem[]>([]);
  const [pagination, setPagination] = useState<PaginatedProjections['pagination'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjections = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listProjections(page, limit);
      setProjections(result.items);
      setPagination(result.pagination);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load projections';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    void fetchProjections();
  }, [fetchProjections]);

  const handleDelete = async (id: string): Promise<boolean> => {
    try {
      await apiDeleteProjection(id);
      setProjections((prev) => prev.filter((p) => p.id !== id));
      return true;
    } catch {
      return false;
    }
  };

  return {
    projections,
    pagination,
    isLoading,
    error,
    refetch: fetchProjections,
    deleteProjection: handleDelete,
  };
}
