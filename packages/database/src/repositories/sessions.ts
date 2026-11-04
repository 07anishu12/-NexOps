import { and, eq, gt, isNull } from 'drizzle-orm';
import type { DatabaseClient } from '../client.js';
import { sessions } from '../schema/index.js';
import { generateSessionToken, hashSessionToken } from '@agentflow/auth';

export interface CreateSessionParams {
  userId: string;
  workspaceId?: string;
  ttlSeconds?: number;
}

export interface SessionResult {
  session: typeof sessions.$inferSelect;
  rawToken: string;
}

export class SessionRepository {
  constructor(private readonly client: DatabaseClient) {}

  /**
   * Create a new session in the database.
   * Generates a 256-bit raw token, stores only its SHA-256 hash, and returns the raw token.
   */
  async createSession(params: CreateSessionParams): Promise<SessionResult> {
    const rawToken = generateSessionToken();
    const sessionTokenHash = hashSessionToken(rawToken);
    const ttlSeconds = params.ttlSeconds ?? 7 * 24 * 3600; // default 7 days
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const [session] = await this.client.db
      .insert(sessions)
      .values({
        sessionTokenHash,
        userId: params.userId,
        workspaceId: params.workspaceId ?? null,
        expiresAt,
        lastSeenAt: new Date()
      })
      .returning();

    if (!session) {
      throw new Error('Failed to create session record');
    }

    return { session, rawToken };
  }

  /**
   * Rotate a session to prevent session fixation upon privilege escalation / login.
   * Atomically revokes the previous session and generates a fresh session credential.
   */
  async rotateSession(
    oldRawToken: string | undefined,
    params: CreateSessionParams
  ): Promise<SessionResult> {
    return this.client.db.transaction(async (tx) => {
      // 1. Invalidate previous session if provided
      if (oldRawToken && oldRawToken.trim().length > 0) {
        const oldHash = hashSessionToken(oldRawToken);
        await tx
          .update(sessions)
          .set({ revokedAt: new Date() })
          .where(and(eq(sessions.sessionTokenHash, oldHash), isNull(sessions.revokedAt)));
      }

      // 2. Issue fresh session
      const rawToken = generateSessionToken();
      const sessionTokenHash = hashSessionToken(rawToken);
      const ttlSeconds = params.ttlSeconds ?? 7 * 24 * 3600;
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      const [session] = await tx
        .insert(sessions)
        .values({
          sessionTokenHash,
          userId: params.userId,
          workspaceId: params.workspaceId ?? null,
          expiresAt,
          lastSeenAt: new Date()
        })
        .returning();

      if (!session) {
        throw new Error('Failed to rotate session record');
      }

      return { session, rawToken };
    });
  }

  /**
   * Revoke a single session by its raw token (logout).
   */
  async revokeSession(rawToken: string): Promise<boolean> {
    const tokenHash = hashSessionToken(rawToken);
    const result = await this.client.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.sessionTokenHash, tokenHash), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });

    return result.length > 0;
  }

  /**
   * Revoke a specific session by its ID for a given user.
   */
  async revokeSessionById(userId: string, sessionId: string): Promise<boolean> {
    const result = await this.client.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt)
        )
      )
      .returning({ id: sessions.id });

    return result.length > 0;
  }

  /**
   * Revoke all active sessions for a user (logout-all / security reset).
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    const result = await this.client.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });

    return result.length;
  }

  /**
   * List all active, non-revoked sessions for a user.
   */
  async listUserSessions(userId: string) {
    const now = new Date();
    return this.client.db
      .select({
        id: sessions.id,
        createdAt: sessions.createdAt,
        expiresAt: sessions.expiresAt,
        lastSeenAt: sessions.lastSeenAt,
        workspaceId: sessions.workspaceId
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now)
        )
      );
  }

  /**
   * Update active workspace selection for a session.
   */
  async updateActiveWorkspace(sessionId: string, workspaceId: string): Promise<boolean> {
    const result = await this.client.db
      .update(sessions)
      .set({ workspaceId })
      .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });

    return result.length > 0;
  }

  /**
   * Update last seen timestamp for active session tracking.
   */
  async touchSession(rawToken: string): Promise<void> {
    const tokenHash = hashSessionToken(rawToken);
    await this.client.db
      .update(sessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(sessions.sessionTokenHash, tokenHash));
  }
}
