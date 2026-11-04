'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Mail,
  Building2,
  ArrowLeft,
  Trash2,
  UserPlus,
  Loader2,
  AlertTriangle,
  Copy,
  Check
} from 'lucide-react';
import { getButtonClassName, getBadgeClassName } from '@agentflow/ui';
import { WorkspaceSwitcher } from '../../../components/WorkspaceSwitcher';
import type { AuthenticatedSession } from '../../../lib/session';

interface SettingsViewProps {
  session: AuthenticatedSession;
  activeWorkspace?: {
    workspaceId: string;
    name: string;
    slug: string;
    role: string;
    plan: string;
  };
}

interface Member {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  createdAt: string;
}

interface Invitation {
  id: string;
  workspaceId: string;
  email: string;
  role: string;
  tokenExpiresAt: string;
  status?: string;
  createdAt: string;
}

export function WorkspaceSettingsView({ session, activeWorkspace }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<'members' | 'invitations' | 'overview'>('members');
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const workspaceId = activeWorkspace?.workspaceId ?? '';
  const userRole = activeWorkspace?.role ?? 'viewer';
  const canManageMembers = ['owner', 'admin'].includes(userRole);

  useEffect(() => {
    if (workspaceId) {
      loadMembers();
      loadInvitations();
    }
  }, [workspaceId]);

  async function loadMembers() {
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`);
      const data = await res.json();
      if (res.ok && data.success) {
        setMembers(data.data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMembers(false);
    }
  }

  async function loadInvitations() {
    setLoadingInvitations(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invitations`);
      const data = await res.json();
      if (res.ok && data.success) {
        setInvitations(data.data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingInvitations(false);
    }
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.error?.message ?? 'Failed to update member role');
        return;
      }
      setActionSuccess('Member role updated successfully');
      loadMembers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error updating member role');
    }
  }

  async function handleRemoveMember(memberId: string, memberName: string) {
    if (!confirm(`Are you sure you want to remove ${memberName} from this workspace?`)) {
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.error?.message ?? 'Failed to remove member');
        return;
      }
      setActionSuccess('Member removed from workspace');
      loadMembers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error removing member');
    }
  }

  async function handleInviteMember(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    setActionError(null);
    setActionSuccess(null);
    setGeneratedInviteLink(null);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.error?.message ?? 'Failed to send invitation');
        setInviting(false);
        return;
      }

      setActionSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      loadInvitations();

      // If mock token returned for local testing
      if (data.data?.invitationUrl) {
        setGeneratedInviteLink(data.data.invitationUrl);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error sending invitation');
    } finally {
      setInviting(false);
    }
  }

  async function handleRevokeInvitation(invitationId: string) {
    if (!confirm('Are you sure you want to revoke this invitation?')) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invitations/${invitationId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.error?.message ?? 'Failed to revoke invitation');
        return;
      }
      setActionSuccess('Invitation revoked');
      loadInvitations();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error revoking invitation');
    }
  }

  function copyInviteLink() {
    if (!generatedInviteLink) return;
    navigator.clipboard.writeText(generatedInviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a
            href="/app"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </a>
          <span className="text-slate-700">|</span>
          <WorkspaceSwitcher
            currentWorkspaceId={workspaceId}
            currentRole={userRole}
            workspaces={session.workspaces}
          />
        </div>

        <div className="flex items-center gap-3">
          <span className={getBadgeClassName('outline')}>Workspace Settings</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-8 space-y-6">
        {/* Title */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <Building2 className="w-6 h-6 text-blue-400" />
            {activeWorkspace?.name ?? 'Workspace'} Settings
          </h1>
          <p className="text-sm text-slate-400">
            Manage team members, roles, permissions, invitations and workspace configuration.
          </p>
        </div>

        {/* Notifications */}
        {actionError && (
          <div className="p-4 bg-rose-950/60 border border-rose-800/80 rounded-xl text-sm text-rose-200 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {actionSuccess && (
          <div className="p-4 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-sm text-emerald-200 flex items-center gap-3">
            <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-slate-800 flex gap-6">
          <button
            onClick={() => setActiveTab('members')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'members'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Team Members ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'invitations'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-4 h-4" />
            Invitations ({invitations.length})
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Workspace Info
          </button>
        </div>

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">Active Members</h3>
                  <p className="text-xs text-slate-400">
                    Collaborators with authenticated access to this workspace.
                  </p>
                </div>
                {canManageMembers && (
                  <button
                    onClick={() => setActiveTab('invitations')}
                    className={getButtonClassName('primary', 'sm')}
                  >
                    <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                    Invite Member
                  </button>
                )}
              </div>

              {loadingMembers ? (
                <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading members...
                </div>
              ) : members.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No members found in this workspace.
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {members.map((member) => {
                    const isSelf = member.userId === session.user.id;
                    return (
                      <div
                        key={member.id}
                        className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-slate-300 uppercase">
                            {member.name ? member.name.charAt(0) : 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-white">
                                {member.name}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 font-medium">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-400">{member.email}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {canManageMembers && !isSelf ? (
                            <select
                              value={member.role}
                              onChange={(e) => handleRoleChange(member.id, e.target.value)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 capitalize focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {userRole === 'owner' && <option value="owner">Owner</option>}
                              <option value="admin">Admin</option>
                              <option value="developer">Developer</option>
                              <option value="operator">Operator</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          ) : (
                            <span className={getBadgeClassName('outline')}>
                              {member.role}
                            </span>
                          )}

                          {canManageMembers && !isSelf && (
                            <button
                              onClick={() => handleRemoveMember(member.id, member.name)}
                              title="Remove member"
                              className="p-1.5 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-950/30 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Invitations Tab */}
        {activeTab === 'invitations' && (
          <div className="space-y-6">
            {canManageMembers && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-white">Invite Team Member</h3>
                  <p className="text-xs text-slate-400">
                    Send a cryptographically signed invitation to join this workspace.
                  </p>
                </div>

                <form onSubmit={handleInviteMember} className="flex flex-col md:flex-row gap-3">
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="flex-1 px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 capitalize focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="admin">Admin</option>
                    <option value="developer">Developer</option>
                    <option value="operator">Operator</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    type="submit"
                    disabled={inviting}
                    className={getButtonClassName('primary', 'md')}
                  >
                    {inviting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Send Invitation
                      </>
                    )}
                  </button>
                </form>

                {generatedInviteLink && (
                  <div className="p-4 rounded-lg bg-blue-950/40 border border-blue-800/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-blue-300">
                        Direct Invitation Acceptance Link (Development / Testing):
                      </span>
                      <button
                        onClick={copyInviteLink}
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-white"
                      >
                        {copiedLink ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy Link
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs font-mono text-slate-300 break-all select-all bg-slate-950/70 p-2.5 rounded border border-slate-800">
                      {generatedInviteLink}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800">
                <h3 className="text-base font-semibold text-white">Pending Invitations</h3>
                <p className="text-xs text-slate-400">
                  Unaccepted invitations expire after 7 days and can only be used once.
                </p>
              </div>

              {loadingInvitations ? (
                <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading invitations...
                </div>
              ) : invitations.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No pending invitations for this workspace.
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <span className="text-sm font-medium text-white">{inv.email}</span>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>Role: <strong className="capitalize text-slate-300">{inv.role}</strong></span>
                          <span>•</span>
                          <span>
                            Expires: {new Date(inv.tokenExpiresAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {canManageMembers && (
                        <button
                          onClick={() => handleRevokeInvitation(inv.id)}
                          className={getButtonClassName('outline', 'sm')}
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <h3 className="text-base font-semibold text-white">Workspace Configuration</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold uppercase">Workspace Name</label>
                <p className="font-semibold text-white">{activeWorkspace?.name}</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold uppercase">Slug Identifier</label>
                <p className="font-mono text-slate-300">{activeWorkspace?.slug}</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold uppercase">Workspace ID</label>
                <p className="font-mono text-xs text-slate-400 truncate">{workspaceId}</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold uppercase">Your Role</label>
                <p className="capitalize font-semibold text-blue-400">{userRole}</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold uppercase">Subscription Plan</label>
                <p className="capitalize font-semibold text-emerald-400">{activeWorkspace?.plan ?? 'developer'}</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold uppercase">Isolation Tier</label>
                <p className="text-xs text-slate-300">Shared Pool with Row-Level Security (RLS)</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
