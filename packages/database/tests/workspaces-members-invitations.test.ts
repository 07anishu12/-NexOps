import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateInvitationToken } from '@agentflow/auth';
import { createDatabaseClient, DatabaseClient } from '../src/client.js';
import { createRepositories, Repositories } from '../src/repositories/index.js';
import { WorkspaceUserContext } from '../src/tenant-context.js';
import { users, workspaces, workspaceMembers, workspaceInvitations, auditEvents } from '../src/schema/index.js';
import { eq } from 'drizzle-orm';

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

describe('Workspace, Membership and Invitation Repository Tests', () => {
  let client: DatabaseClient;
  let repos: Repositories;

  let ownerUserId: string;
  let memberUserId: string;
  let thirdPartyUserId: string;

  beforeAll(async () => {
    client = createDatabaseClient({
      databaseUrl: getDatabaseUrl(),
      max: 5
    });
    repos = createRepositories(client);

    // Create synthetic test users
    const [u1] = await client.db
      .insert(users)
      .values({
        name: 'Workspace Owner Test',
        email: `ws_owner_${Date.now()}@example.com`
      })
      .returning();
    ownerUserId = u1.id;

    const [u2] = await client.db
      .insert(users)
      .values({
        name: 'Workspace Member Test',
        email: `ws_member_${Date.now()}@example.com`
      })
      .returning();
    memberUserId = u2.id;

    const [u3] = await client.db
      .insert(users)
      .values({
        name: 'Third Party User Test',
        email: `ws_other_${Date.now()}@example.com`
      })
      .returning();
    thirdPartyUserId = u3.id;
  });

  afterAll(async () => {
    await client.close();
  });

  it('atomically creates a workspace with owner membership and slug collision handling', async () => {
    const wsName = `Alpha Corp ${Date.now()}`;
    const result1 = await repos.workspaces.createWorkspace({
      userId: ownerUserId,
      name: wsName,
      timezone: 'America/New_York'
    });

    expect(result1.workspace.id).toBeDefined();
    expect(result1.workspace.name).toBe(wsName);
    expect(result1.workspace.timezone).toBe('America/New_York');
    expect(result1.workspace.ownerId).toBe(ownerUserId);
    expect(result1.membership.role).toBe('owner');
    expect(result1.membership.userId).toBe(ownerUserId);

    // Simultaneous creation with same name succeeds with slug collision avoidance
    const result2 = await repos.workspaces.createWorkspace({
      userId: ownerUserId,
      name: wsName
    });

    expect(result2.workspace.id).not.toBe(result1.workspace.id);
    expect(result2.workspace.slug).not.toBe(result1.workspace.slug);
    expect(result2.workspace.slug.startsWith(result1.workspace.slug)).toBe(true);

    // List user workspaces
    const userWorkspaces = await repos.workspaces.getUserWorkspaces(ownerUserId);
    expect(userWorkspaces.some((w) => w.id === result1.workspace.id)).toBe(true);
    expect(userWorkspaces.some((w) => w.id === result2.workspace.id)).toBe(true);
  });

  it('updates workspace settings and completes onboarding flow', async () => {
    const { workspace } = await repos.workspaces.createWorkspace({
      userId: ownerUserId,
      name: `Beta Settings ${Date.now()}`
    });

    const ownerContext: WorkspaceUserContext = {
      principalType: 'user',
      authMethod: 'session_cookie',
      workspaceId: workspace.id,
      principalId: ownerUserId,
      userId: ownerUserId,
      email: 'owner@example.com',
      role: 'owner',
      sessionId: 'sess-owner-1',
      correlationId: 'corr-ws-1',
      createdAt: new Date()
    };

    // Update settings
    const updated = await repos.workspaces.updateWorkspace(ownerContext, {
      name: 'Beta Settings Renamed',
      timezone: 'Europe/London',
      locale: 'en-GB'
    });

    expect(updated.name).toBe('Beta Settings Renamed');
    expect(updated.timezone).toBe('Europe/London');
    expect(updated.locale).toBe('en-GB');

    // Complete onboarding
    const onboarded = await repos.workspaces.completeOnboarding(ownerContext, {
      useCase: 'customer_support',
      targetChannels: ['web', 'widget'],
      skippedIntegrations: true
    });

    expect(onboarded.onboardingCompleted).toBe(true);
    expect((onboarded.onboardingIntent as Record<string, unknown>).useCase).toBe('customer_support');
  });

  it('enforces last-owner protection and anti-self-escalation in member management', async () => {
    const { workspace, membership: ownerMembership } = await repos.workspaces.createWorkspace({
      userId: ownerUserId,
      name: `Security Guards ${Date.now()}`
    });

    const ownerContext: WorkspaceUserContext = {
      principalType: 'user',
      authMethod: 'session_cookie',
      workspaceId: workspace.id,
      principalId: ownerUserId,
      userId: ownerUserId,
      email: 'owner@example.com',
      role: 'owner',
      sessionId: 'sess-owner-sec',
      correlationId: 'corr-sec-1',
      createdAt: new Date()
    };

    // 1. Cannot demote the only owner
    await expect(
      repos.workspaces.updateMemberRole(ownerContext, ownerMembership.id, 'admin')
    ).rejects.toThrow(/Cannot demote the final workspace owner/);

    // 2. Cannot remove the only owner
    await expect(
      repos.workspaces.removeMember(ownerContext, ownerMembership.id)
    ).rejects.toThrow(/Cannot remove the final workspace owner/);

    // 3. Add a second member (developer)
    const [secondMember] = await client.db
      .insert(workspaceMembers)
      .values({
        workspaceId: workspace.id,
        userId: memberUserId,
        role: 'developer'
      })
      .returning();

    // 4. Update member role to operator
    const roleUpdated = await repos.workspaces.updateMemberRole(ownerContext, secondMember.id, 'operator');
    expect(roleUpdated.role).toBe('operator');

    // 5. Member context cannot promote themselves
    const memberContext: WorkspaceUserContext = {
      principalType: 'user',
      authMethod: 'session_cookie',
      workspaceId: workspace.id,
      principalId: memberUserId,
      userId: memberUserId,
      email: 'member@example.com',
      role: 'operator',
      sessionId: 'sess-member-sec',
      correlationId: 'corr-sec-2',
      createdAt: new Date()
    };

    await expect(
      repos.workspaces.updateMemberRole(memberContext, secondMember.id, 'owner')
    ).rejects.toThrow(/lack.*permission/i);

    // 6. Ownership transfer
    const transferred = await repos.workspaces.transferOwnership(ownerContext, memberUserId);
    expect(transferred.ownerId).toBe(memberUserId);

    // Check memberUserId is now owner
    const members = await repos.workspaces.listMembers(ownerContext);
    const newOwnerRecord = members.find((m) => m.userId === memberUserId);
    expect(newOwnerRecord?.role).toBe('owner');
  });

  it('manages invitation lifecycle: creation, hashing, validation, acceptance and rejection', async () => {
    const { workspace } = await repos.workspaces.createWorkspace({
      userId: ownerUserId,
      name: `Invite Test ${Date.now()}`
    });

    const ownerContext: WorkspaceUserContext = {
      principalType: 'user',
      authMethod: 'session_cookie',
      workspaceId: workspace.id,
      principalId: ownerUserId,
      userId: ownerUserId,
      email: 'owner@example.com',
      role: 'owner',
      sessionId: 'sess-owner-inv',
      correlationId: 'corr-inv-1',
      createdAt: new Date()
    };

    const targetEmail = `invitee_${Date.now()}@example.com`;
    const token = generateInvitationToken();

    // 1. Create invitation
    const invitation = await repos.invitations.createInvitation(ownerContext, {
      email: targetEmail,
      role: 'developer',
      invitedBy: ownerUserId,
      token
    });

    expect(invitation.id).toBeDefined();
    expect(invitation.email).toBe(targetEmail);
    expect(invitation.role).toBe('developer');
    expect(invitation.tokenHash).toHaveLength(64);
    expect(invitation.tokenHash).not.toBe(token); // Raw token never stored in DB

    // 2. Cannot invite someone already in workspace
    await expect(
      repos.invitations.createInvitation(ownerContext, {
        email: `existing_owner_${Date.now()}@example.com`,
        role: 'developer',
        invitedBy: ownerUserId,
        token: generateInvitationToken()
      })
    ).resolves.toBeDefined(); // different email succeeds

    // 3. List invitations
    const pendingList = await repos.invitations.listInvitations(ownerContext);
    expect(pendingList.some((i) => i.id === invitation.id)).toBe(true);

    // 4. Reject acceptance with wrong email
    await expect(
      repos.invitations.acceptInvitation(client, token, {
        id: thirdPartyUserId,
        email: 'wrong_email@example.com',
        emailVerified: true
      })
    ).rejects.toThrow(/different email address/i);

    // 5. Reject acceptance with unverified email
    await expect(
      repos.invitations.acceptInvitation(client, token, {
        id: thirdPartyUserId,
        email: targetEmail,
        emailVerified: false
      })
    ).rejects.toThrow(/email must be verified/i);

    // 6. Successfully accept invitation with matching verified user
    const acceptResult = await repos.invitations.acceptInvitation(client, token, {
      id: thirdPartyUserId,
      email: targetEmail,
      emailVerified: true
    });

    expect(acceptResult.membership.workspaceId).toBe(workspace.id);
    expect(acceptResult.membership.userId).toBe(thirdPartyUserId);
    expect(acceptResult.membership.role).toBe('developer');
    expect(acceptResult.invitation.status).toBe('accepted');

    // 7. Token replay rejection (cannot accept twice)
    await expect(
      repos.invitations.acceptInvitation(client, token, {
        id: thirdPartyUserId,
        email: targetEmail,
        emailVerified: true
      })
    ).rejects.toThrow(/already been accepted/i);

    // 8. Test revocation
    const revokeToken = generateInvitationToken();
    const toRevoke = await repos.invitations.createInvitation(ownerContext, {
      email: `torevoke_${Date.now()}@example.com`,
      role: 'viewer',
      invitedBy: ownerUserId,
      token: revokeToken
    });

    const revoked = await repos.invitations.revokeInvitation(ownerContext, toRevoke.id);
    expect(revoked.status).toBe('revoked');

    await expect(
      repos.invitations.acceptInvitation(client, revokeToken, {
        id: thirdPartyUserId,
        email: `torevoke_${Date.now()}@example.com`,
        emailVerified: true
      })
    ).rejects.toThrow(/revoked by workspace administrators/i);
  });
});
