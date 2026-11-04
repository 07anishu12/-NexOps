import { cookies } from 'next/headers';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

export async function forwardApiRequest(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    searchParams?: Record<string, string>;
  } = {}
): Promise<{ status: number; data: any }> {
  let sessionCookie: string | undefined;
  try {
    const cookieStore = await cookies();
    sessionCookie =
      cookieStore.get('__Host-af_session')?.value ??
      cookieStore.get('af_session')?.value;
  } catch {
    // Outside of Next.js request context (e.g. unit tests)
  }

  const url = new URL(`${API_BASE_URL}${path}`);
  if (options.searchParams) {
    for (const [key, val] of Object.entries(options.searchParams)) {
      if (val) url.searchParams.set(key, val);
    }
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };

  if (sessionCookie) {
    headers.Cookie = `af_session=${encodeURIComponent(sessionCookie)}`;
  }

  try {
    const response = await fetch(url.toString(), {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store'
    });

    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  } catch (err) {
    return {
      status: 502,
      data: {
        success: false,
        error: {
          code: 'UPSTREAM_API_UNAVAILABLE',
          message: err instanceof Error ? err.message : 'API server is currently unreachable'
        }
      }
    };
  }
}
