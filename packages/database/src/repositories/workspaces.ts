import { and, eq, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import type { WorkspaceRole } from '@agentflow/contracts';
import { generateWorkspaceSlug, validateWorkspaceSlug } from '@agentflow/domain';
import { workspaces, workspaceMembers, workspaceInvitations, users, auditEvents } from '../schema/index.js';
import {
  WorkspaceContext,
  isWorkspaceUser,
  AuthorizationError,
  NotFoundError,
  ConflictError
} from '../tenant-context.js';
import { BaseRepository } from './base.js';

export interface CreateWorkspaceParams {
  userId: string;
  name: string;
  requestedSlug?: string;
  timezone?: string;
  locale?: string;
}

export interface UpdateWorkspaceParams {
  name?: string;
  timezone?: string;
  locale?: string;
  status?: 'active' | 'archived';
}

export interface OnboardingParams {
  useCase: string;
  targetChannels?: string[];
  skippedIntegrations?: boolean;
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

export class WorkspaceRepository extends BaseRepository {
  /**
   * Atomically creates a workspace, assigns the caller as owner, establishes default settings,
   * records an audit event, and rolls back if any step fails.
   */
  async createWorkspace(params: CreateWorkspaceParams) {
    const { userId, name, requestedSlug, timezone = 'UTC', locale = 'en' } = params;

    if (!name || name.trim().length < 2) {
      throw new ConflictError('Workspace name must be at least 2 characters');
    }

    // Determine target slug
    let candidateSlug: string;
    if (requestedSlug && requestedSlug.trim().length > 0) {
      const validation = validateWorkspaceSlug(requestedSlug);
      if (!validation.valid) {
        throw new ConflictError(validation.reason ?? 'Invalid workspace slug');
      }
      candidateSlug = requestedSlug.trim().toLowerCase();
    } else {
      candidateSlug = generateWorkspaceSlug(name);
    }

    // Execute in transaction with collision retry for uniqueness
    return this.client.db.transaction(async (tx) => {
      // 1. Verify user exists
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw new NotFoundError(`User '${userId}' not found`);
      }

      // 2. Resolve unique slug (checking for existing and appending random suffix on collision)
      let finalSlug = candidateSlug;
      for (let attempt = 0; attempt < 5; attempt++) {
        const [existing] = await tx
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.slug, finalSlug))
          .limit(1);

        if (!existing) {
          break;
        }
        finalSlug = `${candidateSlug}-${randomBytes(2).toString('hex')}`;
      }

      const [createdWorkspace] = await tx
        .insert(workspaces)
        .values({
          name: name.trim(),
          slug: finalSlug,
          ownerId: userId,
          plan: 'free',
          timezone,
          locale,
          status: 'active',
          onboardingCompleted: false,
          onboardingIntent: {}
        })
        .returning();

      if (!createdWorkspace) {
        throw new ConflictError('Unable to allocate a unique workspace slug. Please try another name.');
      }

      // 3. Atomically create owner membership
      const [membership] = await tx
        .insert(workspaceMembers)
        .values({
          workspaceId: createdWorkspace.id,
          userId,
          role: 'owner'
        })
        .returning();

      // 4. Record audit event
      await tx.insert(auditEvents).values({
        workspaceId: createdWorkspace.id,
        actorType: 'user',
        actorId: userId,
        action: 'workspace.created',
        resourceType: 'workspace',
        resourceId: createdWorkspace.id,
        metadata: {
          name: createdWorkspace.name,
          slug: createdWorkspace.slug,
          ownerId: userId
        }
      });

      return {
        workspace: createdWorkspace,
        membership
      };
    });
  }

  /**
   * Retrieves all workspaces accessible by the specified user.
   */
  async getUserWorkspaces(userId: string) {
    return this.client.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        ownerId: workspaces.ownerId,
        plan: workspaces.plan,
        timezone: workspaces.timezone,
        locale: workspaces.locale,
        status: workspaces.status,
        onboardingCompleted: workspaces.onboardingCompleted,
        role: workspaceMembers.role,
        memberSince: workspaceMembers.createdAt
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, userId))
      .orderBy(workspaces.name);
  }

  /**
   * Gets workspace details within a verified tenant context.
   */
  async getWorkspace(context: WorkspaceContext) {
    return this.withScopedTransaction(context, 'workspace:read', async (tx) => {
      const [workspace] = await tx
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, context.workspaceId))
        .limit(1);

      return this.notFoundIfNull(workspace, 'Workspace', context.workspaceId);
    });
  }

  /**
   * Updates workspace settings within a verified tenant context.
   */
  async updateWorkspace(context: WorkspaceContext, input: UpdateWorkspaceParams) {
    return this.withScopedTransaction(context, 'workspace:update', async (tx) => {
      const [updated] = await tx
        .update(workspaces)
        .set({
          ...(input.name ? { name: input.name.trim() } : {}),
          ...(input.timezone ? { timezone: input.timezone } : {}),
          ...(input.locale ? { locale: input.locale } : {}),
          ...(input.status ? { status: input.status } : {}),
          updatedAt: new Date()
        })
        .where(eq(workspaces.id, context.workspaceId))
        .returning();

      const result = this.notFoundIfNull(updated, 'Workspace', context.workspaceId);
      const { actorType, actorId } = getActorMetadata(context);

      // Audit event
      await tx.insert(auditEvents).values({
        workspaceId: context.workspaceId,
        actorType,
        actorId,
        action: 'workspace.updated',
        resourceType: 'workspace',
        resourceId: context.workspaceId,
        metadata: { ...input }
      });

      return result;
    });
  }

  /**
   * Marks workspace onboarding as completed and records user intent.
   */
  async completeOnboarding(context: WorkspaceContext, input: OnboardingParams) {
    return this.withScopedTransaction(context, 'workspace:update', async (tx) => {
      const [updated] = await tx
        .update(workspaces)
        .set({
          onboardingCompleted: true,
          onboardingIntent: {
            ...input,
            completedAt: new Date().toISOString()
          },
          updatedAt: new Date()
        })
        .where(eq(workspaces.id, context.workspaceId))
        .returning();

      const result = this.notFoundIfNull(updated, 'Workspace', context.workspaceId);
      const { actorType, actorId } = getActorMetadata(context);

      await tx.insert(auditEvents).values({
        workspaceId: context.workspaceId,
        actorType,
        actorId,
        action: 'workspace.onboard_complete',
        resourceType: 'workspace',
        resourceId: context.workspaceId,
        metadata: { ...input }
      });

      return result;
    });
  }

  /**
   * Atomically transfers ownership to an existing active workspace member.
   */
  async transferOwnership(context: WorkspaceContext, newOwnerUserId: string) {
    return this.withScopedTransaction(context, 'workspace:transfer_ownership', async (tx) => {
      const callerRole = isWorkspaceUser(context) ? context.role : undefined;
      const callerUserId = isWorkspaceUser(context) ? context.userId : undefined;

      if (callerRole !== 'owner') {
        throw new AuthorizationError('Only an existing owner can transfer workspace ownership');
      }

      if (callerUserId === newOwnerUserId) {
        throw new ConflictError('User is already the workspace owner');
      }

      // Check target member exists
      const [targetMember] = await tx
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, context.workspaceId),
            eq(workspaceMembers.userId, newOwnerUserId)
          )
        )
        .limit(1);

      if (!targetMember) {
        throw new NotFoundError(`Member '${newOwnerUserId}' not found in workspace`);
      }

      // Update workspace ownerId
      const [updatedWorkspace] = await tx
        .update(workspaces)
        .set({
          ownerId: newOwnerUserId,
          updatedAt: new Date()
        })
        .where(eq(workspaces.id, context.workspaceId))
        .returning();

      // Ensure new owner has role = 'owner'
      await tx
        .update(workspaceMembers)
        .set({ role: 'owner', updatedAt: new Date() })
        .where(
          and(
            eq(workspaceMembers.workspaceId, context.workspaceId),
            eq(workspaceMembers.userId, newOwnerUserId)
          )
        );

      const { actorType, actorId } = getActorMetadata(context);

      // Audit event
      await tx.insert(auditEvents).values({
        workspaceId: context.workspaceId,
        actorType,
        actorId,
        action: 'workspace.ownership_transferred',
        resourceType: 'workspace',
        resourceId: context.workspaceId,
        metadata: {
          previousOwnerId: callerUserId,
          newOwnerId: newOwnerUserId
        }
      });

      return updatedWorkspace;
    });
  }

  /**
   * Lists all members of the active workspace.
   */
  async listMembers(context: WorkspaceContext) {
    return this.withScopedTransaction(context, 'member:read', async (tx) => {
      return tx
        .select({
          id: workspaceMembers.id,
          workspaceId: workspaceMembers.workspaceId,
          userId: workspaceMembers.userId,
          role: workspaceMembers.role,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
          createdAt: workspaceMembers.createdAt
        })
        .from(workspaceMembers)
        .innerJoin(users, eq(workspaceMembers.userId, users.id))
        .where(eq(workspaceMembers.workspaceId, context.workspaceId))
        .orderBy(workspaceMembers.createdAt);
    });
  }

  /**
   * Updates a member's role while enforcing last-owner and anti-escalation safety.
   */
  async updateMemberRole(context: WorkspaceContext, memberId: string, newRole: WorkspaceRole) {
    return this.withScopedTransaction(context, 'member:update_role', async (tx) => {
      // Find target member
      const [targetMember] = await tx
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, context.workspaceId),
            eq(workspaceMembers.id, memberId)
          )
        )
        .limit(1);

      if (!targetMember) {
        throw new NotFoundError(`Workspace member '${memberId}' not found`);
      }

      const callerRole = isWorkspaceUser(context) ? context.role : undefined;
      const callerUserId = isWorkspaceUser(context) ? context.userId : undefined;

      // Security Guard: Non-owner cannot assign 'owner' role
      if (newRole === 'owner' && callerRole !== 'owner') {
        throw new AuthorizationError('Only workspace owners can promote members to owner');
      }

      // Security Guard: Member cannot alter their own role to elevate privileges
      if (targetMember.userId === callerUserId && callerRole !== 'owner') {
        throw new AuthorizationError('Members cannot modify their own workspace role');
      }

      // Security Guard: Last owner protection - cannot demote the final owner
      if (targetMember.role === 'owner' && newRole !== 'owner') {
        const rows = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, context.workspaceId),
              eq(workspaceMembers.role, 'owner')
            )
          );

        const count = rows[0]?.count ?? 0;
        if (count <= 1) {
          throw new ConflictError('Cannot demote the final workspace owner. A workspace must retain at least one owner.');
        }
      }

      // Apply role update
      const [updated] = await tx
        .update(workspaceMembers)
        .set({
          role: newRole,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(workspaceMembers.workspaceId, context.workspaceId),
            eq(workspaceMembers.id, memberId)
          )
        )
        .returning();

      const { actorType, actorId } = getActorMetadata(context);

      // Audit event
      await tx.insert(auditEvents).values({
        workspaceId: context.workspaceId,
        actorType,
        actorId,
        action: 'member.role_changed',
        resourceType: 'workspace_member',
        resourceId: memberId,
        metadata: {
          targetUserId: targetMember.userId,
          previousRole: targetMember.role,
          newRole
        }
      });

      return updated;
    });
  }

  /**
   * Removes a member while enforcing last-owner safety.
   */
  async removeMember(context: WorkspaceContext, memberId: string) {
    return this.withScopedTransaction(context, 'member:remove', async (tx) => {
      // Find target member
      const [targetMember] = await tx
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, context.workspaceId),
            eq(workspaceMembers.id, memberId)
          )
        )
        .limit(1);

      if (!targetMember) {
        throw new NotFoundError(`Workspace member '${memberId}' not found`);
      }

      // Security Guard: Last owner protection - cannot remove the final owner
      if (targetMember.role === 'owner') {
        const rows = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, context.workspaceId),
              eq(workspaceMembers.role, 'owner')
            )
          );

        const count = rows[0]?.count ?? 0;
        if (count <= 1) {
          throw new ConflictError('Cannot remove the final workspace owner. A workspace must retain at least one owner.');
        }
      }

      // Unlink accepted invitations for this member in this workspace before deletion
      await tx
        .update(workspaceInvitations)
        .set({ acceptedBy: null })
        .where(
          and(
            eq(workspaceInvitations.workspaceId, context.workspaceId),
            eq(workspaceInvitations.acceptedBy, targetMember.userId)
          )
        );

      // Delete member
      await tx
        .delete(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, context.workspaceId),
            eq(workspaceMembers.id, memberId)
          )
        );

      const { actorType, actorId } = getActorMetadata(context);

      // Audit event
      await tx.insert(auditEvents).values({
        workspaceId: context.workspaceId,
        actorType,
        actorId,
        action: 'member.removed',
        resourceType: 'workspace_member',
        resourceId: memberId,
        metadata: {
          targetUserId: targetMember.userId,
          removedRole: targetMember.role
        }
      });

      return { success: true, removedMemberId: memberId };
    });
  }
}
