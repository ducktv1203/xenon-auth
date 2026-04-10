const DEFAULT_LOCAL_BACKEND_URL = "http://localhost:8000";

export function getBackendUrl(): string {
  const value = import.meta.env.VITE_BACKEND_URL?.trim();
  return value || DEFAULT_LOCAL_BACKEND_URL;
}

export const DEFAULT_BACKEND_URL = getBackendUrl();