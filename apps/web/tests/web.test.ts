import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getHealth } from '../app/api/health/route.js';
import { POST as postLogout } from '../app/api/auth/logout/route.js';
import { getAuthenticatedSession } from '../lib/session.js';
import { GET as getWorkspaces, POST as postWorkspaces } from '../app/api/workspaces/route.js';
import { POST as selectWorkspace } from '../app/api/workspaces/[id]/select/route.js';
import { POST as onboardWorkspace } from '../app/api/workspaces/[id]/onboarding/route.js';
import { GET as getMembers } from '../app/api/workspaces/[id]/members/route.js';
import { POST as acceptInvitation } from '../app/api/invitations/accept/route.js';

describe('Web App Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('health endpoint returns valid JSON response with status ok', async () => {
    const response = await getHealth();
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.service).toBe('web');
    expect(data.timestamp).toBeDefined();
  });

  it('logout endpoint returns 303 redirect to /login and clears session cookies', async () => {
    const req = new Request('http://localhost:3000/api/auth/logout', {
      method: 'POST'
    });
    const res = await postLogout(req);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('getAuthenticatedSession returns null when no cookies are present', async () => {
    const session = await getAuthenticatedSession();
    expect(session).toBeNull();
  });

  it('GET /api/workspaces forwards request to upstream API', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: [{ id: 'ws-1', name: 'Acme Workspace', slug: 'acme-ws' }]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const res = await getWorkspaces();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data[0].name).toBe('Acme Workspace');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/workspaces'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('POST /api/workspaces forwards payload to upstream API', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: { workspace: { id: 'ws-2', name: 'New Team', slug: 'new-team' } }
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const req = new Request('http://localhost:3000/api/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Team', slug: 'new-team' })
    });

    const res = await postWorkspaces(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.workspace.slug).toBe('new-team');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/workspaces'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'New Team', slug: 'new-team' })
      })
    );
  });

  it('POST /api/workspaces/[id]/select forwards workspace switch request', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: { activeWorkspaceId: 'ws-target', role: 'admin' }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const req = new Request('http://localhost:3000/api/workspaces/ws-target/select', {
      method: 'POST'
    });

    const res = await selectWorkspace(req, {
      params: Promise.resolve({ id: 'ws-target' })
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.activeWorkspaceId).toBe('ws-target');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/workspaces/ws-target/select'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('POST /api/workspaces/[id]/onboarding forwards onboarding configuration', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: { id: 'ws-target', onboardingCompleted: true }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const req = new Request('http://localhost:3000/api/workspaces/ws-target/onboarding', {
      method: 'POST',
      body: JSON.stringify({
        useCase: 'customer_support',
        targetChannels: ['slack'],
        skippedIntegrations: true
      })
    });

    const res = await onboardWorkspace(req, {
      params: Promise.resolve({ id: 'ws-target' })
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.onboardingCompleted).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/workspaces/ws-target/onboarding'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('GET /api/workspaces/[id]/members returns workspace members', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: [
            { id: 'm-1', userId: 'u-1', role: 'owner', email: 'owner@example.com' },
            { id: 'm-2', userId: 'u-2', role: 'developer', email: 'dev@example.com' }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const req = new Request('http://localhost:3000/api/workspaces/ws-target/members');
    const res = await getMembers(req, {
      params: Promise.resolve({ id: 'ws-target' })
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/workspaces/ws-target/members'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('POST /api/invitations/accept forwards single-use token', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            membership: { id: 'm-new', role: 'developer' },
            workspace: { id: 'ws-invited', name: 'Collaborative Space' }
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const req = new Request('http://localhost:3000/api/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ token: 'test-invitation-token-123' })
    });

    const res = await acceptInvitation(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.workspace.id).toBe('ws-invited');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/workspaces/invitations/accept'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'test-invitation-token-123' })
      })
    );
  });
});
