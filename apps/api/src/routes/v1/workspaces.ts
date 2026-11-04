import type { FastifyPluginAsync } from 'fastify';
import {
  CreateWorkspaceSchema,
  UpdateWorkspaceSchema,
  UpdateMemberRoleSchema,
  CreateInvitationSchema,
  AcceptInvitationSchema,
  WorkspaceOnboardingSchema,
  TransferOwnershipSchema
} from '@agentflow/contracts';
import { generateInvitationToken } from '@agentflow/auth';
import type { DatabaseClient } from '@agentflow/database';
import { createRepositories } from '@agentflow/database';
import type { EnvConfig } from '@agentflow/config';
import { createSuccessResponse } from '../../lib/responses.js';
import { HttpError } from '../../lib/errors.js';
import type { EmailDeliveryService } from '../../services/email.js';
import { MockEmailService } from '../../services/email.js';

interface WorkspaceRoutesOptions {
  dbClient?: DatabaseClient;
  config?: EnvConfig;
  emailService?: EmailDeliveryService;
}

export const workspaceRoutes: FastifyPluginAsync<WorkspaceRoutesOptions> = async (
  fastify,
  options
) => {
  const dbClient = options.dbClient;
  const repos = dbClient ? createRepositories(dbClient) : null;
  const emailService = options.emailService ?? new MockEmailService();

  // Helper to ensure database is available
  function getRepos() {
    if (!repos || !dbClient) {
      throw new HttpError(500, 'INTERNAL_ERROR', 'Database client is not available');
    }
    return repos;
  }

  // ============================================================================
  // 1. GET /v1/workspaces - List all accessible workspaces for current user
  // ============================================================================
  fastify.get(
    '/',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'List all workspaces where the authenticated principal holds active membership',
        tags: ['Workspaces'],
        security: [{ apiKeyAuth: [] }, { bearerApiKey: [] }, { sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      const tenant = request.tenantContext!;
      if (tenant.principalType !== 'user') {
        throw new HttpError(403, 'FORBIDDEN', 'Only authenticated user principals can list workspaces');
      }

      const { workspaces: wsRepo } = getRepos();
      const list = await wsRepo.getUserWorkspaces(tenant.userId);

      return reply.send(createSuccessResponse(list, request));
    }
  );

  // ============================================================================
  // 2. POST /v1/workspaces - Create a new workspace atomically
  // ============================================================================
  fastify.post(
    '/',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'Atomically provision a new workspace, assign owner role, and initialize defaults',
        tags: ['Workspaces'],
        security: [{ sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      const tenant = request.tenantContext!;
      if (tenant.principalType !== 'user') {
        throw new HttpError(403, 'FORBIDDEN', 'Only authenticated users can create workspaces');
      }

      const parsed = CreateWorkspaceSchema.parse(request.body);
      const { workspaces: wsRepo, sessions: sessionRepo } = getRepos();

      const result = await wsRepo.createWorkspace({
        userId: tenant.userId,
        name: parsed.name,
        requestedSlug: parsed.slug,
        timezone: parsed.timezone,
        locale: parsed.locale
      });

      // Update session active workspace if running under an active browser session
      if (tenant.sessionId) {
        await sessionRepo.updateActiveWorkspace(tenant.sessionId, result.workspace.id);
      }

      return reply.status(201).send(createSuccessResponse(result, request));
    }
  );

  // ============================================================================
  // 3. GET /v1/workspaces/current - Active workspace context
  // ============================================================================
  fastify.get(
    '/current',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'Get active workspace context for the authenticated principal',
        tags: ['Workspaces'],
        security: [{ apiKeyAuth: [] }, { bearerApiKey: [] }, { sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      const tenant = request.tenantContext!;
      const { workspaces: wsRepo } = getRepos();
      const workspace = await wsRepo.getWorkspace(tenant);

      return reply.send(
        createSuccessResponse(
          {
            workspace,
            role: tenant.principalType === 'user' ? tenant.role : 'admin',
            principalType: tenant.principalType,
            principalId: tenant.principalId
          },
          request
        )
      );
    }
  );

  // ============================================================================
  // 4. GET /v1/workspaces/:workspaceId - Workspace details
  // ============================================================================
  fastify.get(
    '/:workspaceId',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'Retrieve details for the specified workspace',
        tags: ['Workspaces'],
        params: {
          type: 'object',
          properties: { workspaceId: { type: 'string', format: 'uuid' } },
          required: ['workspaceId']
        },
        security: [{ apiKeyAuth: [] }, { bearerApiKey: [] }, { sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const tenant = request.tenantContext!;

      // Enforce tenant boundary
      if (tenant.workspaceId !== workspaceId) {
        throw new HttpError(403, 'FORBIDDEN', 'Access to another workspace requires switching active context');
      }

      const { workspaces: wsRepo } = getRepos();
      const workspace = await wsRepo.getWorkspace(tenant);

      return reply.send(createSuccessResponse(workspace, request));
    }
  );

  // ============================================================================
  // 5. PATCH /v1/workspaces/:workspaceId - Update workspace settings
  // ============================================================================
  fastify.patch(
    '/:workspaceId',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'Update workspace name, timezone, locale or status',
        tags: ['Workspaces'],
        params: {
          type: 'object',
          properties: { workspaceId: { type: 'string', format: 'uuid' } },
          required: ['workspaceId']
        },
        security: [{ apiKeyAuth: [] }, { bearerApiKey: [] }, { sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const tenant = request.tenantContext!;

      if (tenant.workspaceId !== workspaceId) {
        throw new HttpError(403, 'FORBIDDEN', 'Cannot mutate a workspace without active tenant context');
      }

      const parsed = UpdateWorkspaceSchema.parse(request.body);
      const { workspaces: wsRepo } = getRepos();
      const updated = await wsRepo.updateWorkspace(tenant, parsed);

      return reply.send(createSuccessResponse(updated, request));
    }
  );

  // ============================================================================
  // 6. POST /v1/workspaces/:workspaceId/select - Switch active workspace
  // ============================================================================
  fastify.post(
    '/:workspaceId/select',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'Switch active workspace context for the current user session',
        tags: ['Workspaces'],
        params: {
          type: 'object',
          properties: { workspaceId: { type: 'string', format: 'uuid' } },
          required: ['workspaceId']
        },
        security: [{ sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const tenant = request.tenantContext!;

      if (tenant.principalType !== 'user') {
        throw new HttpError(403, 'FORBIDDEN', 'Only user sessions can switch active workspaces');
      }

      const { workspaces: wsRepo, sessions: sessionRepo } = getRepos();

      // 1. Verify user holds active membership in target workspace
      const userWorkspaces = await wsRepo.getUserWorkspaces(tenant.userId);
      const targetMembership = userWorkspaces.find((w) => w.id === workspaceId);

      if (!targetMembership) {
        throw new HttpError(403, 'FORBIDDEN', 'User is not a member of the requested workspace');
      }

      // 2. Persist selection to server session
      if (tenant.sessionId) {
        await sessionRepo.updateActiveWorkspace(tenant.sessionId, workspaceId);
      }

      return reply.send(
        createSuccessResponse(
          {
            activeWorkspaceId: workspaceId,
            role: targetMembership.role,
            workspaceName: targetMembership.name,
            slug: targetMembership.slug
          },
          request
        )
      );
    }
  );

  // ============================================================================
  // 7. POST /v1/workspaces/:workspaceId/onboarding - Complete onboarding
  // ============================================================================
  fastify.post(
    '/:workspaceId/onboarding',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'Persist use-case selection and mark onboarding wizard completed',
        tags: ['Workspaces'],
        params: {
          type: 'object',
          properties: { workspaceId: { type: 'string', format: 'uuid' } },
          required: ['workspaceId']
        },
        security: [{ sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const tenant = request.tenantContext!;

      if (tenant.workspaceId !== workspaceId) {
        throw new HttpError(403, 'FORBIDDEN', 'Tenant mismatch');
      }

      const parsed = WorkspaceOnboardingSchema.parse(request.body);
      const { workspaces: wsRepo } = getRepos();
      const updated = await wsRepo.completeOnboarding(tenant, parsed);

      return reply.send(createSuccessResponse(updated, request));
    }
  );

  // ============================================================================
  // 8. POST /v1/workspaces/:workspaceId/transfer-ownership - Transfer ownership
  // ============================================================================
  fastify.post(
    '/:workspaceId/transfer-ownership',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'Atomically transfer workspace ownership to another active member',
        tags: ['Workspaces'],
        params: {
          type: 'object',
          properties: { workspaceId: { type: 'string', format: 'uuid' } },
          required: ['workspaceId']
        },
        security: [{ sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const tenant = request.tenantContext!;

      if (tenant.workspaceId !== workspaceId) {
        throw new HttpError(403, 'FORBIDDEN', 'Tenant mismatch');
      }

      const parsed = TransferOwnershipSchema.parse(request.body);
      const { workspaces: wsRepo } = getRepos();
      const result = await wsRepo.transferOwnership(tenant, parsed.newOwnerUserId);

      return reply.send(createSuccessResponse(result, request));
    }
  );

  // ============================================================================
  // 9. GET /v1/workspaces/:workspaceId/members - List members
  // ============================================================================
  fastify.get(
    '/:workspaceId/members',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'List all active members and assigned roles in the workspace',
        tags: ['Workspaces'],
        params: {
          type: 'object',
          properties: { workspaceId: { type: 'string', format: 'uuid' } },
          required: ['workspaceId']
        },
        security: [{ apiKeyAuth: [] }, { bearerApiKey: [] }, { sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const tenant = request.tenantContext!;

      if (tenant.workspaceId !== workspaceId) {
        throw new HttpError(403, 'FORBIDDEN', 'Tenant mismatch');
      }

      const { workspaces: wsRepo } = getRepos();
      const members = await wsRepo.listMembers(tenant);

      return reply.send(createSuccessResponse(members, request));
    }
  );

  // ============================================================================
  // 10. PATCH /v1/workspaces/:workspaceId/members/:memberId - Update member role
  // ============================================================================
  fastify.patch(
    '/:workspaceId/members/:memberId',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'Change the role of an existing workspace member',
        tags: ['Workspaces'],
        params: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', format: 'uuid' },
            memberId: { type: 'string', format: 'uuid' }
          },
          required: ['workspaceId', 'memberId']
        },
        security: [{ sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      const { workspaceId, memberId } = request.params as { workspaceId: string; memberId: string };
      const tenant = request.tenantContext!;

      if (tenant.workspaceId !== workspaceId) {
        throw new HttpError(403, 'FORBIDDEN', 'Tenant mismatch');
      }

      const parsed = UpdateMemberRoleSchema.parse(request.body);
      const { workspaces: wsRepo } = getRepos();
      const updated = await wsRepo.updateMemberRole(tenant, memberId, parsed.role);

      return reply.send(createSuccessResponse(updated, request));
    }
  );

  // ============================================================================
  // 11. DELETE /v1/workspaces/:workspaceId/members/:memberId - Remove member
  // ============================================================================
  fastify.delete(
    '/:workspaceId/members/:memberId',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'Remove a member from the workspace with last-owner protection',
        tags: ['Workspaces'],
        params: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', format: 'uuid' },
            memberId: { type: 'string', format: 'uuid' }
          },
          required: ['workspaceId', 'memberId']
        },
        security: [{ sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      const { workspaceId, memberId } = request.params as { workspaceId: string; memberId: string };
      const tenant = request.tenantContext!;

      if (tenant.workspaceId !== workspaceId) {
        throw new HttpError(403, 'FORBIDDEN', 'Tenant mismatch');
      }

      const { workspaces: wsRepo } = getRepos();
      const result = await wsRepo.removeMember(tenant, memberId);

      return reply.send(createSuccessResponse(result, request));
    }
  );

  // ============================================================================
  // 12. POST /v1/workspaces/:workspaceId/invitations - Create invitation
  // ============================================================================
  fastify.post(
    '/:workspaceId/invitations',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'Invite a user by email to join the workspace with a specific role',
        tags: ['Workspaces'],
        params: {
          type: 'object',
          properties: { workspaceId: { type: 'string', format: 'uuid' } },
          required: ['workspaceId']
        },
        security: [{ sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const tenant = request.tenantContext!;

      if (tenant.workspaceId !== workspaceId) {
        throw new HttpError(403, 'FORBIDDEN', 'Tenant mismatch');
      }

      if (tenant.principalType !== 'user') {
        throw new HttpError(403, 'FORBIDDEN', 'Only authenticated user principals can invite members');
      }

      const parsed = CreateInvitationSchema.parse(request.body);
      const { invitations: invRepo, workspaces: wsRepo } = getRepos();
      const currentWorkspace = await wsRepo.getWorkspace(tenant);

      const rawToken = generateInvitationToken();
      const invitation = await invRepo.createInvitation(tenant, {
        email: parsed.email,
        role: parsed.role,
        invitedBy: tenant.userId,
        token: rawToken
      });

      // Dispatch invitation email via abstraction
      const webUrl = options.config?.APP_URL ?? 'http://localhost:3000';
      const acceptUrl = `${webUrl}/invite?token=${encodeURIComponent(rawToken)}`;

      const delivery = await emailService.sendInvitationEmail({
        to: parsed.email,
        workspaceName: currentWorkspace.name,
        inviterName: tenant.email,
        role: parsed.role,
        invitationToken: rawToken,
        acceptUrl
      });

      return reply.status(201).send(
        createSuccessResponse(
          {
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            status: invitation.status,
            expiresAt: invitation.expiresAt,
            emailDelivery: delivery
          },
          request
        )
      );
    }
  );

  // ============================================================================
  // 13. GET /v1/workspaces/:workspaceId/invitations - List pending invitations
  // ============================================================================
  fastify.get(
    '/:workspaceId/invitations',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'List all pending invitations for the active workspace',
        tags: ['Workspaces'],
        params: {
          type: 'object',
          properties: { workspaceId: { type: 'string', format: 'uuid' } },
          required: ['workspaceId']
        },
        security: [{ apiKeyAuth: [] }, { bearerApiKey: [] }, { sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const tenant = request.tenantContext!;

      if (tenant.workspaceId !== workspaceId) {
        throw new HttpError(403, 'FORBIDDEN', 'Tenant mismatch');
      }

      const { invitations: invRepo } = getRepos();
      const list = await invRepo.listInvitations(tenant);

      return reply.send(createSuccessResponse(list, request));
    }
  );

  // ============================================================================
  // 14. POST /v1/workspaces/:workspaceId/invitations/:invitationId/revoke - Revoke invite
  // ============================================================================
  fastify.post(
    '/:workspaceId/invitations/:invitationId/revoke',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'Revoke an outstanding workspace invitation',
        tags: ['Workspaces'],
        params: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', format: 'uuid' },
            invitationId: { type: 'string', format: 'uuid' }
          },
          required: ['workspaceId', 'invitationId']
        },
        security: [{ sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      const { workspaceId, invitationId } = request.params as {
        workspaceId: string;
        invitationId: string;
      };
      const tenant = request.tenantContext!;

      if (tenant.workspaceId !== workspaceId) {
        throw new HttpError(403, 'FORBIDDEN', 'Tenant mismatch');
      }

      const { invitations: invRepo } = getRepos();
      const revoked = await invRepo.revokeInvitation(tenant, invitationId);

      return reply.send(createSuccessResponse(revoked, request));
    }
  );

  // ============================================================================
  // 15. POST /v1/workspaces/invitations/accept - Accept invitation
  // ============================================================================
  fastify.post(
    '/invitations/accept',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'Accept an invitation using single-use token verification',
        tags: ['Workspaces'],
        security: [{ sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      const tenant = request.tenantContext!;
      if (tenant.principalType !== 'user') {
        throw new HttpError(403, 'FORBIDDEN', 'Only authenticated users can accept invitations');
      }

      const parsed = AcceptInvitationSchema.parse(request.body);
      const { invitations: invRepo, sessions: sessionRepo } = getRepos();

      const result = await invRepo.acceptInvitation(dbClient!, parsed.token, {
        id: tenant.userId,
        email: tenant.email,
        emailVerified: true
      });

      // Update active workspace in user session
      if (tenant.sessionId && result.workspace) {
        await sessionRepo.updateActiveWorkspace(tenant.sessionId, result.workspace.id);
      }

      return reply.send(createSuccessResponse(result, request));
    }
  );
};
