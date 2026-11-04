import React from 'react';
import { redirect } from 'next/navigation';
import { Settings, Plus, Users, Shield, Terminal, ArrowUpRight } from 'lucide-react';
import { getButtonClassName, getBadgeClassName } from '@agentflow/ui';
import { getAuthenticatedSession } from '../../lib/session';
import { WorkspaceSwitcher } from '../../components/WorkspaceSwitcher';

export default async function ConsoleDashboardPage() {
  const session = await getAuthenticatedSession();

  if (!session) {
    redirect('/login?returnTo=/app');
  }

  const { user, activeWorkspace, workspaces } = session;
  const currentWorkspace =
    workspaces.find((w) => w.workspaceId === activeWorkspace?.workspaceId) ??
    workspaces[0] ?? {
      workspaceId: 'default',
      name: 'Default Workspace',
      slug: 'default',
      role: activeWorkspace?.role ?? 'owner',
      plan: 'developer'
    };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-bold text-lg bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
            AgentFlow OS
          </span>
          <span className="text-slate-600">/</span>
          <WorkspaceSwitcher
            currentWorkspaceId={currentWorkspace.workspaceId}
            currentRole={activeWorkspace?.role ?? 'owner'}
            workspaces={workspaces}
          />
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/app/settings"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Settings & Members
          </a>

          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className={getButtonClassName('outline', 'sm')}
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Welcome back, {user.name}
            </h1>
            <p className="text-slate-400 text-sm">
              Operating in <strong className="text-blue-400">{currentWorkspace.name}</strong> ({currentWorkspace.slug}) • Role: <span className="capitalize">{activeWorkspace?.role ?? 'owner'}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/app/workspaces/new"
              className={getButtonClassName('outline', 'md')}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Workspace
            </a>
            <a
              href="/app/settings"
              className={getButtonClassName('primary', 'md')}
            >
              <Users className="w-4 h-4 mr-2" />
              Manage Team
            </a>
          </div>
        </div>

        {/* Workspace Security Profile Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active Tenant Scope
              </h3>
              <Shield className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xl font-bold text-white">{currentWorkspace.name}</p>
            <p className="text-xs text-emerald-400 flex items-center gap-1 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              Row-Level Security (RLS) Active
            </p>
            <p className="text-xs text-slate-500 font-mono truncate">
              ID: {currentWorkspace.workspaceId}
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Role & Entitlements
              </h3>
              <Terminal className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold capitalize text-white">
                {activeWorkspace?.role ?? 'owner'}
              </span>
              <span className={getBadgeClassName('outline')}>
                {currentWorkspace.plan.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              35 granular permissions scoped across 10 security domains
            </p>
            <p className="text-xs text-slate-500">
              Anti-privilege escalation & last-owner protections active
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Session Identity
              </h3>
              <span className={getBadgeClassName('success')}>Google OIDC</span>
            </div>
            <p className="text-sm font-semibold text-white truncate">{user.email}</p>
            <p className="text-xs text-blue-400">HTTP-Only __Host-af_session</p>
            <p className="text-xs text-slate-500 font-mono">User ID: {user.id}</p>
          </div>
        </div>

        {/* Quick Operations Guide */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
            <p className="text-xs text-slate-400">
              Core administrative and operational workflows for this workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/app/settings"
              className="p-4 rounded-xl border border-slate-800 bg-slate-950/50 hover:border-slate-700 transition-all group block"
            >
              <div className="flex items-center justify-between text-slate-200 group-hover:text-blue-400 mb-1">
                <span className="font-semibold text-sm">Team & Invitations</span>
                <ArrowUpRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-xs text-slate-400">
                Add team members as Admins, Developers, Operators, or Viewers.
              </p>
            </a>

            <a
              href={`/onboarding?workspaceId=${currentWorkspace.workspaceId}`}
              className="p-4 rounded-xl border border-slate-800 bg-slate-950/50 hover:border-slate-700 transition-all group block"
            >
              <div className="flex items-center justify-between text-slate-200 group-hover:text-blue-400 mb-1">
                <span className="font-semibold text-sm">Re-run Setup Wizard</span>
                <ArrowUpRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-xs text-slate-400">
                Configure primary use cases, target channels, and integrations.
              </p>
            </a>

            <a
              href="/app/workspaces/new"
              className="p-4 rounded-xl border border-slate-800 bg-slate-950/50 hover:border-slate-700 transition-all group block"
            >
              <div className="flex items-center justify-between text-slate-200 group-hover:text-blue-400 mb-1">
                <span className="font-semibold text-sm">Create Workspace</span>
                <ArrowUpRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-xs text-slate-400">
                Spin up an isolated tenant sandbox for custom workloads.
              </p>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
