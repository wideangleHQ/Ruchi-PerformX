import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const axiosClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false, // token is in localStorage, not httpOnly cookie
});

// Attach JWT from localStorage on every request
axiosClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
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
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        // Only redirect if not already on a public page
        const isPublic = ['/login', '/signup', '/verify-otp', '/forgot-password', '/reset-password'].some(
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
