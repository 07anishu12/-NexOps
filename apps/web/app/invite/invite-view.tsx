'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, CheckCircle2, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import { getButtonClassName, getBadgeClassName } from '@agentflow/ui';
import type { AuthenticatedSession } from '../../lib/session';

interface InviteViewProps {
  token: string;
  session: AuthenticatedSession | null;
}

export function InviteView({ token, session }: InviteViewProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:4000';
  const returnTo = encodeURIComponent(`/invite?token=${token}`);
  const googleLoginUrl = `${apiBaseUrl}/v1/auth/google/start?returnTo=${returnTo}`;

  async function handleAccept() {
    if (!token) {
      setError('Missing invitation token.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error?.message ?? 'Failed to accept invitation');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/app');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error accepting invitation');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6 text-center">
        <div className="flex justify-center">
          <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/20">
            <Mail className="w-8 h-8" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-center">
            <span className={getBadgeClassName('outline')}>Workspace Invitation</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Join Workspace on AgentFlow OS
          </h1>
          <p className="text-xs text-slate-400">
            You have received an invitation to collaborate on an AgentFlow OS workspace.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg text-xs text-rose-200 flex items-center gap-2 text-left">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="p-4 bg-emerald-950/60 border border-emerald-800/80 rounded-xl space-y-2 text-emerald-300">
            <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-400" />
            <p className="font-semibold text-sm">Invitation Accepted!</p>
            <p className="text-xs text-emerald-400/80">Redirecting to your dashboard...</p>
          </div>
        ) : !session ? (
          <div className="space-y-4 pt-2">
            <p className="text-xs text-slate-400">
              Please sign in with your verified email account to accept this invitation.
            </p>
            <a
              href={googleLoginUrl}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-medium rounded-lg transition-colors shadow-sm text-sm"
            >
              Sign in with Google to Accept
              <ArrowRight className="w-4 h-4 ml-1" />
            </a>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-left space-y-1">
              <span className="text-[11px] text-slate-500 uppercase font-semibold">Signed in as:</span>
              <p className="text-xs text-white font-medium">{session.user.name}</p>
              <p className="text-xs text-slate-400 font-mono truncate">{session.user.email}</p>
            </div>

            <button
              onClick={handleAccept}
              disabled={loading}
              className={`w-full ${getButtonClassName('primary', 'lg')}`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Accepting Invitation...
                </>
              ) : (
                'Accept Workspace Invitation'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
