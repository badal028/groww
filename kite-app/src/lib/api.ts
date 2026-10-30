export const API_BASE: string = (import.meta.env.VITE_API_BASE as string) || "https://growwtrader.in";
export const TOKEN_KEY = "pro_auth_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) => {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body = init.body;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, body });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok || data?.status === "error") {
    if (res.status === 401 && token && path !== "/auth/login") {
      window.dispatchEvent(new CustomEvent("pro-auth-expired"));
    }
    throw new ApiError(data?.message || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}
