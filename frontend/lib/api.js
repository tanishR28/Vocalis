import { getProfile } from './profile';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

let accessTokenGetter = null;

export function setAccessTokenGetter(getter) {
  accessTokenGetter = getter;
}

function getAccessToken() {
  if (typeof accessTokenGetter === 'function') {
    return accessTokenGetter();
  }
  return null;
}

function buildAuthHeaders(extra = {}) {
  const headers = { ...extra };
  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function getApiUserId() {
  return getProfile()?.userId || null;
}

export function withUserIdParams(params = {}) {
  const next = new URLSearchParams(params);
  const userId = getApiUserId();
  if (userId) next.set('user_id', userId);
  return next;
}

export async function apiFetch(path, options = {}) {
  const { headers: extraHeaders, ...rest } = options;
  const headers = buildAuthHeaders(extraHeaders);

  return fetch(`${API_URL}${path}`, {
    ...rest,
    headers,
  });
}

export async function apiFetchJson(path, options = {}) {
  const response = await apiFetch(path, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }
  return response.json();
}

export { API_URL };
