import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to extract a cookie value by name
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Request interceptor: attach CSRF token to mutations
api.interceptors.request.use((config) => {
  const csrfToken = getCookie('csrf_token');
  if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

// Response interceptor: handle errors safely
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Extract server message or fallback
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';
    
    return Promise.reject({
      status: error.response?.status,
      message,
      data: error.response?.data,
    });
  }
);
