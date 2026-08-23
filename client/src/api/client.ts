import axios, { AxiosInstance, AxiosError } from 'axios';

/**
 * The API mounts everything under the `api/v1` global prefix set in `main.ts`,
 * and every call in `src/api` is written relative to it, so the base URL has to
 * carry it.
 *
 * Setting `NEXT_PUBLIC_API_URL` to the bare host is an easy mistake, because
 * that is exactly what `NEXT_PUBLIC_SOCKET_URL` wants, and the two variables
 * otherwise look identical. It turns every request in the product into a 404
 * with no other symptom: the host answers, so it is not CORS and not a network
 * error, and login simply fails. Append the prefix when it is missing rather
 * than let one character of configuration take the whole app down.
 *
 * Accepts `https://host`, `https://host/`, `https://host/api/v1` and
 * `https://host/api/v1/`, and leaves a future `/api/v2` alone.
 */
const RAW_API_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'
).replace(/\/+$/, '');

const API_URL = /\/api\/v\d+$/.test(RAW_API_URL)
  ? RAW_API_URL
  : `${RAW_API_URL}/api/v1`;


const axiosClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false, // token is in localStorage, not httpOnly cookie
});

// Attach JWT from localStorage on every request
axiosClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const requestUrl = config.url ?? '';
      const isVmsPage = window.location.pathname.startsWith('/vms');
      const isVmsRequest = requestUrl.includes('/vms/') || isVmsPage;
      const token = isVmsRequest
        ? (localStorage.getItem('vmsAccessToken') || localStorage.getItem('accessToken'))
        : localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      const headers = config.headers;
      if (headers) {
        if ('delete' in headers && typeof headers.delete === 'function') {
          headers.delete('Content-Type');
          headers.delete('content-type');
        } else {
          delete (headers as Record<string, unknown>)['Content-Type'];
          delete (headers as Record<string, unknown>)['content-type'];
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Handle 401 — clear token and redirect to login
axiosClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        const requestUrl = error.config?.url ?? '';
        const isVmsPage = window.location.pathname.startsWith('/vms');
        const isVmsRequest = requestUrl.includes('/vms/') || isVmsPage;
        if (isVmsRequest) {
          localStorage.removeItem('vmsAccessToken');
          localStorage.removeItem('vmsAccessType');
          if (isVmsPage) {
            window.location.href = '/vms';
          }
          return Promise.reject(error);
        }

        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        // Only redirect if not already on a public page
        const isPublic = ['/login', '/signup', '/register-success', '/forgot-password', '/forgot-password-success'].some(
          (p) => window.location.pathname.startsWith(p)
        );
        if (!isPublic) {
          window.location.href = '/login';
        }
      }
    }

    if (error.response?.status === 403) {
      console.error('[API] Access forbidden:', error.response?.data);
    }

    if (error.response && error.response.status >= 500) {
      console.error('[API] Server error:', error.response?.data);
    }

    return Promise.reject(error);
  },
);

export default axiosClient;
