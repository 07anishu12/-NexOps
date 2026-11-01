import { WorkspaceRole } from '@agentflow/contracts';

export interface UserSession {
  userId: string;
  email: string;
  activeWorkspaceId: string;
  role: WorkspaceRole;
  createdAt: number;
  expiresAt: number;
}

export function isSessionExpired(session: UserSession): boolean {
  return Date.now() >= session.expiresAt;
}

export function createSession(params: {
  userId: string;
  email: string;
  workspaceId: string;
  role: WorkspaceRole;
  ttlSeconds?: number;
}): UserSession {
  const now = Date.now();
  const ttl = (params.ttlSeconds ?? 86400) * 1000;
  return {
    userId: params.userId,
    email: params.email,
    activeWorkspaceId: params.workspaceId,
    role: params.role,
    createdAt: now,
    expiresAt: now + ttl
  };
}
