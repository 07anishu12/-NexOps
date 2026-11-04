import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  let sessionToken: string | undefined;
  try {
    const cookieStore = await cookies();
    sessionToken =
      cookieStore.get('__Host-af_session')?.value ??
      cookieStore.get('af_session')?.value;
  } catch {
    const rawCookie = request.headers.get('cookie');
    const match = rawCookie?.match(/(?:^|;\s*)(?:__Host-)?af_session=([^;]+)/);
    if (match?.[1]) sessionToken = decodeURIComponent(match[1]);
  }

  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:4000';

  if (sessionToken) {
    try {
      await fetch(`${apiBaseUrl}/v1/auth/logout`, {
        method: 'POST',
        headers: {
          Cookie: `af_session=${encodeURIComponent(sessionToken)}`,
          'Content-Type': 'application/json'
        }
      });
    } catch {
      // Best-effort remote revocation
    }
  }

  // Clear local cookies
  const response = NextResponse.redirect(new URL('/login', request.url), 303);
  response.cookies.delete('af_session');
  response.cookies.delete('__Host-af_session');

  return response;
}
