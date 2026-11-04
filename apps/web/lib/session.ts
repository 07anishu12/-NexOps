import { cookies } from 'next/headers';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface ActiveWorkspace {
  workspaceId: string;
  role: string;
}

export interface AuthenticatedSession {
  user: AuthenticatedUser;
  activeWorkspace?: ActiveWorkspace;
  workspaces: Array<{
    workspaceId: string;
    name: string;
    slug: string;
    role: string;
    plan: string;
  }>;
  principalType: 'user';
  authMethod: string;
  sessionId: string;
}

export async function getAuthenticatedSession(): Promise<AuthenticatedSession | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie =
      cookieStore.get('__Host-af_session')?.value ??
      cookieStore.get('af_session')?.value;

    if (!sessionCookie) {
      return null;
    }

    const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:4000';
    const response = await fetch(`${apiBaseUrl}/v1/auth/me`, {
      method: 'GET',
      headers: {
        Cookie: `af_session=${encodeURIComponent(sessionCookie)}`,
        Accept: 'application/json'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    if (!payload.success || payload.data.principalType !== 'user') {
      return null;
    }

    return payload.data as AuthenticatedSession;
  } catch {
    return null;
  }
}
