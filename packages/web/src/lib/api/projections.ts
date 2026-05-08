/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * Projection API Service
 *
 * Uses the centralized API client with automatic token refresh.
 */
import type { ProjectionDetail, PaginatedProjections } from '@/types/projection';
import { api } from './client';

/**
 * Fetch a single projection by ID
 */
export async function getProjection(id: string): Promise<ProjectionDetail> {
  const result = await api.get<ProjectionDetail>(`/projections/${id}`);
  return result.data;
}

/**
 * List all projections for the current user
 */
export async function listProjections(
  page: number = 1,
  limit: number = 20
): Promise<PaginatedProjections> {
  const result = await api.get<ProjectionDetail[]>(`/projections?page=${page}&limit=${limit}`);
  return {
    items: result.data,
    pagination: result.pagination!,
  };
}

/**
 * Create a new projection
 */
export async function createProjection(data: {
  name: string;
  description?: string;
  inputData: unknown;
}): Promise<ProjectionDetail> {
  const result = await api.post<ProjectionDetail>('/projections', data);
  return result.data;
}

/**
 * Recalculate an existing projection
 */
export async function recalculateProjection(id: string): Promise<ProjectionDetail> {
  const result = await api.post<ProjectionDetail>(`/projections/${id}/calculate`);
  return result.data;
}

/**
 * Update a projection
 */
export async function updateProjection(
  id: string,
  data: {
    name?: string;
    description?: string;
    inputData?: unknown;
  }
): Promise<ProjectionDetail> {
  const result = await api.put<ProjectionDetail>(`/projections/${id}`, data);
  return result.data;
}

/**
 * Delete a projection
 */
export async function deleteProjection(id: string): Promise<void> {
  await api.delete(`/projections/${id}`);
}
