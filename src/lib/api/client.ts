const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Callers render `message` directly, so it must always be a string. Our API
// sends `{ error: string }`, but other upstreams (gateways, misrouted proxies)
// send `{ error: { code, message } }` — rendering that object crashes React.
export function errorMessage(data: unknown, fallback: string): string {
  const err = (data as { error?: unknown } | null)?.error;
  if (typeof err === 'string' && err) return err;
  if (err && typeof err === 'object') {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return fallback;
}

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  private setToken(token: string) {
    localStorage.setItem('token', token);
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  private setRefreshToken(token: string) {
    localStorage.setItem('refreshToken', token);
  }

  private clearTokens() {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  }

  private refreshing: Promise<boolean> | null = null;

  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        this.clearTokens();
        return false;
      }

      const data = await res.json() as { token: string; refreshToken: string };
      this.setToken(data.token);
      this.setRefreshToken(data.refreshToken);
      return true;
    } catch {
      this.clearTokens();
      return false;
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    opts?: { token?: string; skipAuth?: boolean; asText?: boolean },
  ): Promise<T> {
    const headers: Record<string, string> = {};
    const token = opts?.token ?? this.getToken();

    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    let res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && !opts?.skipAuth) {
      if (!this.refreshing) {
        this.refreshing = this.refreshAccessToken();
      }
      const refreshed = await this.refreshing;
      this.refreshing = null;

      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.getToken()}`;
        res = await fetch(`${API_BASE}${path}`, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
      }
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.statusText }));
      throw { status: res.status, message: errorMessage(data, res.statusText) };
    }

    if (res.status === 204) return undefined as T;
    // Not every endpoint speaks JSON. The receipt route returns text/plain so
    // it can go straight to a thermal printer; res.json() on that throws a
    // parse error that reads like a server fault. Opt in per call rather than
    // sniffing Content-Type, so the caller's expectation is explicit.
    if (opts?.asText) return (await res.text()) as T;
    return res.json() as Promise<T>;
  }

  get<T>(path: string, opts?: { skipAuth?: boolean; asText?: boolean }): Promise<T> {
    return this.request<T>('GET', path, undefined, opts);
  }

  post<T>(path: string, body?: unknown, opts?: { skipAuth?: boolean }): Promise<T> {
    return this.request<T>('POST', path, body, opts);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  async upload<T>(path: string, formData: FormData): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (res.status === 401) {
      if (!this.refreshing) {
        this.refreshing = this.refreshAccessToken();
      }
      const refreshed = await this.refreshing;
      this.refreshing = null;

      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.getToken()}`;
        res = await fetch(`${API_BASE}${path}`, {
          method: 'POST',
          headers,
          body: formData,
        });
      }
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.statusText }));
      throw { status: res.status, message: errorMessage(data, res.statusText) };
    }

    return res.json() as Promise<T>;
  }
}

export const api = new ApiClient();
