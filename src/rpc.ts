// src/rpc.ts
export type AuthMode = 'header' | 'query';

const API_KEY = import.meta.env.VITE_FASTNEAR_API_KEY; // .env/.env.example

export function withFastNearAuth(
  url: string,
  init: RequestInit = {},
  mode: AuthMode = 'header'
): [string, RequestInit] {
  if (!API_KEY) return [url, init];

  if (mode === 'query') {
    const u = new URL(url);
    // using an explicit name so logs/metrics are easy to filter
    u.searchParams.set('fastnear_api_key', API_KEY);
    return [u.toString(), init];
  }

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${API_KEY}`);
  return [url, { ...init, headers }];
}

// Simple JSON-RPC helper
export async function rpcCall<T = unknown>(
  endpoint: string,
  method: string,
  params: unknown,
  auth: AuthMode = 'header'
): Promise<T> {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 'fastnear', method, params });
  const [url, init] = withFastNearAuth(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  }, auth);

  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`RPC ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'RPC error');
  return json.result as T;
}
