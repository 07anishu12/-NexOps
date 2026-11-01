import React from 'react';
import { getButtonClassName, getBadgeClassName } from '@agentflow/ui';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-950 text-slate-100">
      <div className="max-w-4xl w-full text-center space-y-6">
        <div className="flex justify-center">
          <span className={getBadgeClassName('success')}>AgentFlow OS v0.1.0 • Ready</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
          Multi-Tenant Agentic AI Platform
        </h1>
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">
          Build once. Deploy anywhere. Operate reliably. A forward deployed engineering control plane with durable LangGraph runs, deterministic security policies, and cryptographic approval gates.
        </p>
        <div className="flex justify-center gap-4 pt-4">
          <a href="/app" className={getButtonClassName('primary', 'lg')}>
            Launch Console
          </a>
          <a href="/api/health" className={getButtonClassName('outline', 'lg')}>
            Service Health Check
          </a>
        </div>
      </div>
    </main>
  );
}
