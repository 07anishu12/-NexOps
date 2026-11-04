import { and, eq } from 'drizzle-orm';
import type { WorkspaceRole } from '@agentflow/contracts';
import { hashInvitationToken } from '@agentflow/auth';
import type { DatabaseClient } from '../client.js';
import { workspaceInvitations, workspaceMembers, workspaces, users, auditEvents } from '../schema/index.js';
import {
  WorkspaceContext,
  isWorkspaceUser,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  AuthenticationError
} from '../tenant-context.js';
import { BaseRepository } from './base.js';

export interface CreateInvitationParams {
  email: string;
  role: WorkspaceRole;
  invitedBy: string;
  token: string;
  expiresInDays?: number;
}

export interface AuthenticatedAcceptUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

function getActorMetadata(context: WorkspaceContext): {
  actorType: 'user' | 'api_key' | 'widget' | 'worker' | 'system' | 'support';
  actorId: string;
} {
  let actorType: 'user' | 'api_key' | 'widget' | 'worker' | 'system' | 'support' = 'user';
  if ('principalType' in context) {
    if (context.principalType === 'widget_session') {
      actorType = 'widget';
    } else {
      actorType = context.principalType;
    }
  }
  const actorId = 'principalId' in context ? context.principalId : (context.userId ?? 'system');
  return { actorType, actorId };
}

export class InvitationRepository extends BaseRepository {
  /**
   * Creates a single-use invitation within a verified tenant context.
   * Plaintext token is hashed; raw token is never written to PostgreSQL.
   */
  async createInvitation(context: WorkspaceContext, params: CreateInvitationParams) {
    return this.withScopedTransaction(context, 'member:invite', async (tx) => {
      const email = params.email.toLowerCase().trim();
      const callerRole = isWorkspaceUser(context) ? context.role : undefined;

      // Security Guard: Non-owners cannot invite someone as an owner
      if (params.role === 'owner' && callerRole !== 'owner') {
        throw new AuthorizationError('Only workspace owners can invite new owners');
      }

      // Check if user is already an active member of the workspace
      const [existingMember] = await tx
        .select()
        .from(workspaceMembers)
        .innerJoin(users, eq(workspaceMembers.userId, users.id))
        .where(
          and(
            eq(workspaceMembers.workspaceId, context.workspaceId),
            eq(users.email, email)
          )
        )
        .limit(1);

      if (existingMember) {
        throw new ConflictError(`User ${email} is already a member of this workspace`);
      }

      // Invalidate any existing pending invitations for this email in this workspace
      await tx
        .update(workspaceInvitations)
        .set({ status: 'revoked' })
        .where(
          and(
            eq(workspaceInvitations.workspaceId, context.workspaceId),
            eq(workspaceInvitations.email, email),
            eq(workspaceInvitations.status, 'pending')
          )
        );

      const tokenHash = hashInvitationToken(params.token);
      const expiresInDays = params.expiresInDays ?? 7;
      const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000);

      const [invitation] = await tx
        .insert(workspaceInvitations)
        .values({
          workspaceId: context.workspaceId,
          email,
          role: params.role,
          tokenHash,
          invitedBy: params.invitedBy,
          status: 'pending',
          expiresAt
        })
        .returning();

      if (!invitation) {
        throw new ConflictError('Failed to record workspace invitation');
      }

      const { actorType, actorId } = getActorMetadata(context);

      // Audit event
      await tx.insert(auditEvents).values({
        workspaceId: context.workspaceId,
        actorType,
        actorId,
        action: 'member.invited',
        resourceType: 'workspace_invitation',
        resourceId: invitation.id,
        metadata: {
          email,
          role: params.role,
          expiresAt: expiresAt.toISOString()
        }
      });

      return invitation;
    });
  }

  /**
   * Lists all pending invitations for the active workspace.
   */
  async listInvitations(context: WorkspaceContext) {
    return this.withScopedTransaction(context, 'member:read', async (tx) => {
      return tx
        .select({
          id: workspaceInvitations.id,
          workspaceId: workspaceInvitations.workspaceId,
          email: workspaceInvitations.email,
          role: workspaceInvitations.role,
          status: workspaceInvitations.status,
          invitedBy: workspaceInvitations.invitedBy,
          inviterName: users.name,
          expiresAt: workspaceInvitations.expiresAt,
          createdAt: workspaceInvitations.createdAt
        })
        .from(workspaceInvitations)
        .leftJoin(users, eq(workspaceInvitations.invitedBy, users.id))
        .where(
          and(
            eq(workspaceInvitations.workspaceId, context.workspaceId),
            eq(workspaceInvitations.status, 'pending')
          )
        )
        .orderBy(workspaceInvitations.createdAt);
    });
  }

  /**
   * Revokes a pending invitation.
   */
  async revokeInvitation(context: WorkspaceContext, invitationId: string) {
    return this.withScopedTransaction(context, 'member:invite', async (tx) => {
      const [revoked] = await tx
        .update(workspaceInvitations)
        .set({ status: 'revoked' })
        .where(
          and(
            eq(workspaceInvitations.workspaceId, context.workspaceId),
            eq(workspaceInvitations.id, invitationId),
            eq(workspaceInvitations.status, 'pending')
          )
        )
        .returning();

      if (!revoked) {
        throw new NotFoundError(`Pending invitation '${invitationId}' not found`);
      }

      const { actorType, actorId } = getActorMetadata(context);

      // Audit event
      await tx.insert(auditEvents).values({
        workspaceId: context.workspaceId,
        actorType,
        actorId,
        action: 'invitation.revoked',
        resourceType: 'workspace_invitation',
        resourceId: invitationId,
        metadata: { email: revoked.email }
      });

      return revoked;
    });
  }

  /**
   * Atomically accepts an invitation using raw token verification.
   * Runs inside an atomic transaction.
   */
  async acceptInvitation(client: DatabaseClient, token: string, user: AuthenticatedAcceptUser) {
    if (!token || token.trim().length === 0) {
      throw new ConflictError('Invitation token is required');
    }

    if (!user.emailVerified) {
      throw new AuthenticationError('Your email must be verified before accepting an invitation');
    }

    const tokenHash = hashInvitationToken(token);
    const now = new Date();

    return client.db.transaction(async (tx) => {
      // 1. Find invitation by token hash
      const [invitation] = await tx
        .select()
        .from(workspaceInvitations)
        .where(eq(workspaceInvitations.tokenHash, tokenHash))
        .limit(1);

      if (!invitation) {
        throw new NotFoundError('Invitation token is invalid or does not exist');
      }

      if (invitation.status === 'revoked') {
        throw new ConflictError('This invitation has been revoked by workspace administrators');
      }

      if (invitation.status === 'accepted') {
        throw new ConflictError('This invitation has already been accepted');
      }

      if (invitation.expiresAt <= now) {
        await tx
          .update(workspaceInvitations)
          .set({ status: 'expired' })
          .where(eq(workspaceInvitations.id, invitation.id));
        throw new ConflictError('This invitation has expired');
      }

      // 2. Anti-hijacking: Verify matching email
      if (invitation.email.toLowerCase().trim() !== user.email.toLowerCase().trim()) {
        throw new AuthorizationError('This invitation was sent to a different email address');
      }

      // 3. Atomically create or verify membership
      const [existingMember] = await tx
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, invitation.workspaceId),
            eq(workspaceMembers.userId, user.id)
          )
        )
        .limit(1);

      let membership = existingMember;
      if (!membership) {
        const [createdMember] = await tx
          .insert(workspaceMembers)
          .values({
            workspaceId: invitation.workspaceId,
            userId: user.id,
            role: invitation.role
          })
          .returning();
        membership = createdMember;
      }

      // 4. Mark invitation accepted
      const [acceptedInvitation] = await tx
        .update(workspaceInvitations)
        .set({
          status: 'accepted',
          acceptedAt: now,
          acceptedBy: user.id
        })
        .where(eq(workspaceInvitations.id, invitation.id))
        .returning();

      // 5. Audit event
      await tx.insert(auditEvents).values({
        workspaceId: invitation.workspaceId,
        actorType: 'user',
        actorId: user.id,
        action: 'invitation.accepted',
        resourceType: 'workspace_invitation',
        resourceId: invitation.id,
        metadata: {
          email: user.email,
          role: invitation.role,
          acceptedBy: user.id
        }
      });

      // 6. Fetch workspace details
      const [workspace] = await tx
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, invitation.workspaceId))
        .limit(1);

      return {
        workspace,
        membership,
        invitation: acceptedInvitation
      };
    });
  }
}
