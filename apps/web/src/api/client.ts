import axios from 'axios';
import { useAuthStore } from '../store/auth';

/**
 * Axios instance for the Verity API. In dev, requests to /api are forwarded to
 * the backend by the Vite proxy (see vite.config.ts), avoiding CORS.
 */
export const apiClient = axios.create({ baseURL: '/api' });

// Attach the bearer token to every request.
apiClient.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Error carrying the HTTP status so callers can branch on it (e.g. 404). */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

// Log the user out on 401 and normalise the API error envelope into an Error.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      useAuthStore.getState().logout();
    }
    const apiError = error.response?.data?.error;
    return Promise.reject(
      new ApiRequestError(apiError?.message ?? error.message, status),
    );
  },
);
