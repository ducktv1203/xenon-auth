const DEFAULT_LOCAL_BACKEND_URL = "http://localhost:8000";

function readBackendUrl(): string {
  const value = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
  return value || DEFAULT_LOCAL_BACKEND_URL;
}

export const BACKEND_URL = readBackendUrl();