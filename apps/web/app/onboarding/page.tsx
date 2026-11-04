'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Sparkles,
  Bot,
  MessageSquare,
  Cpu,
  Layers,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Check
} from 'lucide-react';
import { getButtonClassName, getBadgeClassName } from '@agentflow/ui';

const USE_CASES = [
  {
    id: 'customer_support',
    title: 'Customer Support & Resolution',
    desc: 'Autonomous multi-turn agent for inbound issues, ticketing and triage.'
  },
  {
    id: 'devops_cloud',
    title: 'DevOps & Cloud SRE Operations',
    desc: 'Forward deployed infrastructure agents, automated runbooks, and telemetry.'
  },
  {
    id: 'sales_revenue',
    title: 'Sales & Revenue Enablement',
    desc: 'CRM enrichment, RFP response drafting, and proactive pipeline intelligence.'
  },
  {
    id: 'custom_ops',
    title: 'Custom Agentic Workflows',
    desc: 'Flexible LangGraph agents with deterministic tool sandboxes and human approval.'
  }
];

const CHANNELS = [
  { id: 'slack', name: 'Slack Bot' },
  { id: 'teams', name: 'Microsoft Teams' },
  { id: 'email', name: 'Email (SMTP/IMAP)' },
  { id: 'widget', name: 'Embeddable Web Widget' },
  { id: 'webhook', name: 'Custom HTTP Webhooks' }
];

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspaceId') ?? '';

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedUseCase, setSelectedUseCase] = useState('customer_support');
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['slack', 'widget']);
  const [skippedIntegrations, setSkippedIntegrations] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleChannel(channelId: string) {
    setSelectedChannels((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId]
    );
  }

  async function handleComplete() {
    if (!workspaceId) {
      router.push('/app');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useCase: selectedUseCase,
          targetChannels: selectedChannels,
          skippedIntegrations
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error?.message ?? 'Failed to finalize onboarding');
        setLoading(false);
        return;
      }

      router.push('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error during onboarding');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-8">
        {/* Header & Steps */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className={getBadgeClassName('success')}>Workspace Setup Wizard</span>
            <span className="text-xs text-slate-400 font-medium">Step {step} of 3</span>
          </div>

          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg text-xs text-rose-200">
            {error}
          </div>
        )}

        {/* Step 1: Use Case */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <Bot className="w-6 h-6 text-blue-400" />
                What primary use case is this workspace for?
              </h2>
              <p className="text-sm text-slate-400">
                This configures the default agent architecture and safety guardrails.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {USE_CASES.map((uc) => {
                const isSelected = selectedUseCase === uc.id;
                return (
                  <button
                    key={uc.id}
                    type="button"
                    onClick={() => setSelectedUseCase(uc.id)}
                    className={`p-5 rounded-xl border text-left transition-all relative ${
                      isSelected
                        ? 'border-blue-500 bg-blue-600/10 shadow-lg shadow-blue-500/10'
                        : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                    }`}
                  >
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-blue-400 absolute top-4 right-4" />
                    )}
                    <h3 className="font-semibold text-white text-base mb-1">{uc.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{uc.desc}</p>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className={getButtonClassName('primary', 'md')}
              >
                Continue to Channels
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Channels */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-indigo-400" />
                Select Target Communication Channels
              </h2>
              <p className="text-sm text-slate-400">
                Where should your agents interact with users and external systems?
              </p>
            </div>

            <div className="space-y-2.5">
              {CHANNELS.map((ch) => {
                const isSelected = selectedChannels.includes(ch.id);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => toggleChannel(ch.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-600/10 text-white'
                        : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-medium text-sm">{ch.name}</span>
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'border-slate-700 bg-slate-900'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={getButtonClassName('outline', 'md')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className={getButtonClassName('primary', 'md')}
              >
                Continue to Integrations
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Integrations & Completion */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <Cpu className="w-6 h-6 text-cyan-400" />
                Connect Integrations & Complete Setup
              </h2>
              <p className="text-sm text-slate-400">
                Configure external tools or skip to start with the standard mock adapters.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/50 space-y-4">
              <div className="flex items-start gap-3">
                <Layers className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-white">Default Tool Adapters Ready</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    AgentFlow OS provides built-in mock transports for PostgreSQL, Redis, and Email
                    during development. You can connect live production webhooks, credentials, and
                    OAuth apps anytime from workspace settings.
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-3 pt-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={skippedIntegrations}
                  onChange={(e) => setSkippedIntegrations(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                Skip third-party integration setup for now (Recommended for rapid start)
              </label>
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className={getButtonClassName('outline', 'md')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleComplete}
                className={getButtonClassName('primary', 'md')}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Completing Setup...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Finish & Launch Console
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading wizard...</div>}>
      <OnboardingContent />
    </Suspense>
  );
}
