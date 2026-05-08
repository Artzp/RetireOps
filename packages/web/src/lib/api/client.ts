/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/**
 * API Client with automatic token refresh
 *
 * This client handles:
 * - Adding Authorization headers to requests
 * - Detecting 401 responses (expired tokens)
 * - Automatically refreshing tokens
 * - Retrying failed requests with new tokens
 * - Redirecting to login if refresh fails
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Attempt to refresh the access token using the refresh token
 */
async function refreshTokens(): Promise<boolean> {
  const accessToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;

  if (!accessToken || !refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    localStorage.setItem('accessToken', result.data.tokens.accessToken);
    localStorage.setItem('refreshToken', result.data.tokens.refreshToken);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear tokens and redirect to login
 */
function handleSessionExpired(): never {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  }
  throw new Error('Session expired');
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Thrown for non-2xx API responses. Carries the HTTP status and the
 * server's structured `{ code, message }` so callers can branch on code.
 */
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Extended request options — superset of RequestInit that advertises the AbortSignal
 * field explicitly so callers get type-safety. The signal is forwarded to fetch().
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-28
 */
export interface ApiRequestOptions extends RequestInit {
  /** AbortSignal for cancelling in-flight requests (D-28). Re-throws AbortError as-is. */
  signal?: AbortSignal;
}

/**
 * Make an API request with automatic token refresh on 401
 */
export async function apiClient<T>(
  url: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const makeRequest = async (authToken: string | null) => {
    return fetch(`${API_BASE}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...options.headers,
      },
    });
  };

  // D-28: AbortError (from signal.abort()) propagates as-is — callers catch it separately.
  // fetch() throws DOMException with name='AbortError' when the signal fires; we do NOT
  // wrap it in ApiError so the hook's try/catch can distinguish abort from real errors.
  let response: Response;
  try {
    response = await makeRequest(token);
  } catch (err) {
    // Re-throw AbortError and network errors (TypeError) without wrapping them.
    // Only HTTP-level errors (non-ok responses) become ApiError instances below.
    if (err instanceof Error && (err.name === 'AbortError' || err instanceof TypeError)) {
      throw err;
    }
    throw err;
  }

  // Handle 401 - attempt token refresh
  if (response.status === 401) {
    // Prevent multiple simultaneous refresh attempts
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshTokens();
    }

    const refreshed = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (refreshed) {
      // Retry with new token
      const newToken = localStorage.getItem('accessToken');
      const retryResponse = await makeRequest(newToken);

      if (!retryResponse.ok) {
        const error = await retryResponse.json().catch(() => ({}));
        throw new ApiError(
          retryResponse.status,
          error.error?.message || 'Request failed',
          error.error?.code
        );
      }

      return retryResponse.json();
    } else {
      // Refresh failed - session expired
      handleSessionExpired();
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      error.error?.message || 'Request failed',
      error.error?.code
    );
  }

  return response.json();
}

/**
 * Convenience methods for common HTTP verbs.
 * All methods accept an optional `ApiRequestOptions` that includes `signal?: AbortSignal`
 * for AbortController cancellation (D-28). AbortError is propagated as-is — callers
 * should catch it separately from ApiError.
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-28
 */
export const api = {
  get: <T>(url: string, options?: ApiRequestOptions) =>
    apiClient<T>(url, { ...options, method: 'GET' }),

  post: <T>(url: string, data?: unknown, options?: ApiRequestOptions) =>
    apiClient<T>(url, {
      ...options,
      method: 'POST',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),

  put: <T>(url: string, data?: unknown, options?: ApiRequestOptions) =>
    apiClient<T>(url, {
      ...options,
      method: 'PUT',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(url: string, data?: unknown, options?: ApiRequestOptions) =>
    apiClient<T>(url, {
      ...options,
      method: 'PATCH',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(url: string, options?: ApiRequestOptions) =>
    apiClient<T>(url, { ...options, method: 'DELETE' }),
};
