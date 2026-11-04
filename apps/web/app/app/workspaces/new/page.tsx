'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { getButtonClassName, getBadgeClassName } from '@agentflow/ui';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export default function NewWorkspacePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [customSlug, setCustomSlug] = useState(false);
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setName(val);
    if (!customSlug) {
      setSlug(slugify(val));
    }
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCustomSlug(true);
    setSlug(slugify(e.target.value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Workspace name is required');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug || undefined,
          timezone
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error?.message ?? 'Failed to create workspace');
        setLoading(false);
        return;
      }

      const createdWorkspace = data.data.workspace;
      // Redirect to onboarding flow for the newly created workspace
      router.push(`/onboarding?workspaceId=${createdWorkspace.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error creating workspace');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Create New Workspace</h1>
              <p className="text-xs text-slate-400">Establish a tenant sandbox for agents & workflows</p>
            </div>
          </div>
          <span className={getBadgeClassName('outline')}>Multi-Tenant</span>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg text-xs text-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Workspace Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={handleNameChange}
              placeholder="e.g. Acme Ops Core"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-500"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Workspace Slug URL
              </label>
              <span className="text-[11px] text-slate-500">Auto-generated & normalized</span>
            </div>
            <div className="flex items-center rounded-lg bg-slate-950 border border-slate-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent px-3">
              <span className="text-xs text-slate-500 select-none">agentflow.io/</span>
              <input
                type="text"
                value={slug}
                onChange={handleSlugChange}
                placeholder="acme-ops-core"
                className="w-full py-2.5 px-1 bg-transparent text-sm text-slate-100 focus:outline-none font-mono placeholder-slate-600"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Timezone
            </label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="UTC or America/New_York"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-xs"
            />
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-slate-800">
            <a
              href="/app"
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Cancel
            </a>
            <button
              type="submit"
              disabled={loading}
              className={getButtonClassName('primary', 'md')}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create Workspace
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
