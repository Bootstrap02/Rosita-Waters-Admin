export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'https://client-backend-1-tl1r.onrender.com'
).replace(/\/+$/, '');

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.message || `API request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return result.data;
}
