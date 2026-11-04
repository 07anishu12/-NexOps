import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDatabaseClient, DatabaseClient } from '@agentflow/database';
import { users, workspaces, workspaceMembers, workspaceInvitations } from '@agentflow/database';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/app.js';
import { MockEmailService } from '../src/services/email.js';

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const envPath = resolve(process.cwd(), '../../.env');
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DATABASE_URL=')) {
        return trimmed.slice('DATABASE_URL='.length).replace(/^(['"])(.*)\1$/, '$2');
      }
    }
  } catch {
    // fallback
  }
  return 'postgresql://agentflow_owner:agentflow_owner_pass@localhost:5432/agentflow_db';
}

describe('Stage 08: Workspaces, Onboarding, Membership and RBAC API', () => {
  let app: FastifyInstance;
  let dbClient: DatabaseClient;
  let emailService: MockEmailService;

  let ownerUser: typeof users.$inferSelect;
  let inviteeUser: typeof users.$inferSelect;
  let ownerSessionToken: string;
  let inviteeSessionToken: string;
  let createdWorkspaceId: string;

  beforeAll(async () => {
    dbClient = createDatabaseClient({
      databaseUrl: getDatabaseUrl(),
      max: 5
    });

    emailService = new MockEmailService();

    app = await buildApp({
      dbClient,
      emailService,
      enableRateLimit: false
    });
    await app.ready();

    // 1. Create owner test user and login session via direct repo
    const { identity, sessions: sessionRepo } = (app as unknown as { repositories?: any }).repositories ?? {
      identity: new (await import('@agentflow/database')).IdentityRepository(dbClient),
      sessions: new (await import('@agentflow/database')).SessionRepository(dbClient)
    };

    const ownerResolved = await identity.findOrCreateUserFromGoogle({
      providerSubject: `google_sub_owner_${Date.now()}`,
      email: `owner_${Date.now()}@example.com`,
      name: 'Workspace Owner API Test',
      emailVerified: true
    });
    ownerUser = ownerResolved.user;

    const ownerSession = await sessionRepo.createSession({
      userId: ownerUser.id,
      workspaceId: ownerResolved.defaultWorkspaceId,
      expiresInSeconds: 86400
    });
    ownerSessionToken = ownerSession.rawToken;

    // 2. Create invitee user and login session
    const inviteeResolved = await identity.findOrCreateUserFromGoogle({
      providerSubject: `google_sub_invitee_${Date.now()}`,
      email: `invitee_${Date.now()}@example.com`,
      name: 'Invitee API Test',
      emailVerified: true
    });
    inviteeUser = inviteeResolved.user;

    const inviteeSession = await sessionRepo.createSession({
      userId: inviteeUser.id,
      workspaceId: inviteeResolved.defaultWorkspaceId,
      expiresInSeconds: 86400
    });
    inviteeSessionToken = inviteeSession.rawToken;
  });

  afterAll(async () => {
    await app.close();
    await dbClient.close();
  });

  it('GET /v1/workspaces returns all accessible workspaces for authenticated user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/workspaces',
      headers: {
        'x-session-token': ownerSessionToken
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].role).toBe('owner');
  });

  it('POST /v1/workspaces creates a new workspace atomically with owner membership', async () => {
    const wsName = `Enterprise Hub ${Date.now()}`;
    const res = await app.inject({
      method: 'POST',
      url: '/v1/workspaces',
      headers: {
        'x-session-token': ownerSessionToken
      },
      payload: {
        name: wsName,
        timezone: 'Asia/Kolkata',
        locale: 'en-IN'
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.workspace.name).toBe(wsName);
    expect(body.data.workspace.ownerId).toBe(ownerUser.id);
    expect(body.data.membership.role).toBe('owner');

    createdWorkspaceId = body.data.workspace.id;
  });

  it('PATCH /v1/workspaces/:workspaceId updates workspace settings', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/workspaces/${createdWorkspaceId}`,
      headers: {
        'x-session-token': ownerSessionToken,
        'x-workspace-id': createdWorkspaceId
      },
      payload: {
        name: 'Enterprise Hub Renamed',
        timezone: 'UTC'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Enterprise Hub Renamed');
    expect(body.data.timezone).toBe('UTC');
  });

  it('POST /v1/workspaces/:workspaceId/onboarding marks onboarding completed', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${createdWorkspaceId}/onboarding`,
      headers: {
        'x-session-token': ownerSessionToken,
        'x-workspace-id': createdWorkspaceId
      },
      payload: {
        useCase: 'sales_qualification',
        targetChannels: ['web', 'api'],
        skippedIntegrations: true
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.onboardingCompleted).toBe(true);
    expect(body.data.onboardingIntent.useCase).toBe('sales_qualification');
  });

  it('POST /v1/workspaces/:workspaceId/invitations invites a member and dispatches email', async () => {
    emailService.clear();

    const res = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${createdWorkspaceId}/invitations`,
      headers: {
        'x-session-token': ownerSessionToken,
        'x-workspace-id': createdWorkspaceId
      },
      payload: {
        email: inviteeUser.email,
        role: 'developer'
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.email).toBe(inviteeUser.email);
    expect(body.data.role).toBe('developer');
    expect(body.data.status).toBe('pending');

    // Verify mock email delivery was captured
    expect(emailService.sentEmails).toHaveLength(1);
    expect(emailService.sentEmails[0].to).toBe(inviteeUser.email);
    expect(emailService.sentEmails[0].role).toBe('developer');
    expect(emailService.sentEmails[0].invitationToken).toBeDefined();
  });

  it('GET /v1/workspaces/:workspaceId/invitations lists pending invitations', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${createdWorkspaceId}/invitations`,
      headers: {
        'x-session-token': ownerSessionToken,
        'x-workspace-id': createdWorkspaceId
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.some((i: any) => i.email === inviteeUser.email)).toBe(true);
  });

  it('POST /v1/workspaces/invitations/accept accepts invitation and joins workspace', async () => {
    const rawToken = emailService.sentEmails[0].invitationToken;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/invitations/accept',
      headers: {
        'x-session-token': inviteeSessionToken
      },
      payload: {
        token: rawToken
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.membership.workspaceId).toBe(createdWorkspaceId);
    expect(body.data.membership.userId).toBe(inviteeUser.id);
    expect(body.data.membership.role).toBe('developer');
  });

  it('PATCH /v1/workspaces/:workspaceId/members/:memberId updates role to operator', async () => {
    // 1. Get members list
    const membersRes = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${createdWorkspaceId}/members`,
      headers: {
        'x-session-token': ownerSessionToken,
        'x-workspace-id': createdWorkspaceId
      }
    });
    const members = membersRes.json().data;
    const inviteeMember = members.find((m: any) => m.userId === inviteeUser.id);
    expect(inviteeMember).toBeDefined();

    // 2. Update role to operator
    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/v1/workspaces/${createdWorkspaceId}/members/${inviteeMember.id}`,
      headers: {
        'x-session-token': ownerSessionToken,
        'x-workspace-id': createdWorkspaceId
      },
      payload: {
        role: 'operator'
      }
    });

    expect(updateRes.statusCode).toBe(200);
    const body = updateRes.json();
    expect(body.success).toBe(true);
    expect(body.data.role).toBe('operator');
  });

  it('POST /v1/workspaces/:workspaceId/select switches active workspace for session', async () => {
    const selectRes = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${createdWorkspaceId}/select`,
      headers: {
        'x-session-token': inviteeSessionToken
      }
    });

    expect(selectRes.statusCode).toBe(200);
    const body = selectRes.json();
    expect(body.success).toBe(true);
    expect(body.data.activeWorkspaceId).toBe(createdWorkspaceId);
    expect(body.data.role).toBe('operator');

    // Next request to /v1/auth/me reflects active workspace and effective role
    const meRes = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: {
        'x-session-token': inviteeSessionToken
      }
    });

    expect(meRes.statusCode).toBe(200);
    const meBody = meRes.json();
    expect(meBody.data.activeWorkspace.workspaceId).toBe(createdWorkspaceId);
    expect(meBody.data.activeWorkspace.role).toBe('operator');
  });

  it('enforces RBAC: operator cannot mutate workspace settings and receives 403', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/workspaces/${createdWorkspaceId}`,
      headers: {
        'x-session-token': inviteeSessionToken,
        'x-workspace-id': createdWorkspaceId
      },
      payload: {
        name: 'Unauthorized Operator Rename'
      }
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('enforces last-owner protection: owner cannot demote or remove themselves when only 1 owner remains', async () => {
    const membersRes = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${createdWorkspaceId}/members`,
      headers: {
        'x-session-token': ownerSessionToken,
        'x-workspace-id': createdWorkspaceId
      }
    });
    const members = membersRes.json().data;
    const ownerMember = members.find((m: any) => m.userId === ownerUser.id);

    // Try to demote self
    const demoteRes = await app.inject({
      method: 'PATCH',
      url: `/v1/workspaces/${createdWorkspaceId}/members/${ownerMember.id}`,
      headers: {
        'x-session-token': ownerSessionToken,
        'x-workspace-id': createdWorkspaceId
      },
      payload: {
        role: 'viewer'
      }
    });

    expect(demoteRes.statusCode).toBe(409);
    expect(demoteRes.json().error.code).toBe('CONFLICT');

    // Try to delete self
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/v1/workspaces/${createdWorkspaceId}/members/${ownerMember.id}`,
      headers: {
        'x-session-token': ownerSessionToken,
        'x-workspace-id': createdWorkspaceId
      }
    });

    expect(deleteRes.statusCode).toBe(409);
    expect(deleteRes.json().error.code).toBe('CONFLICT');
  });

  it('DELETE /v1/workspaces/:workspaceId/members/:memberId removes operator member', async () => {
    const membersRes = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${createdWorkspaceId}/members`,
      headers: {
        'x-session-token': ownerSessionToken,
        'x-workspace-id': createdWorkspaceId
      }
    });
    const members = membersRes.json().data;
    const inviteeMember = members.find((m: any) => m.userId === inviteeUser.id);

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/v1/workspaces/${createdWorkspaceId}/members/${inviteeMember.id}`,
      headers: {
        'x-session-token': ownerSessionToken,
        'x-workspace-id': createdWorkspaceId
      }
    });

    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.json().success).toBe(true);

    // Removed member can no longer access the workspace
    const accessRes = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${createdWorkspaceId}`,
      headers: {
        'x-session-token': inviteeSessionToken,
        'x-workspace-id': createdWorkspaceId
      }
    });

    expect(accessRes.statusCode).toBe(403);
    expect(accessRes.json().error.code).toBe('FORBIDDEN');
  });
});
