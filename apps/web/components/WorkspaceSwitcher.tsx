'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Plus, Settings, Building2 } from 'lucide-react';
import { getBadgeClassName } from '@agentflow/ui';

interface WorkspaceItem {
  workspaceId: string;
  name: string;
  slug: string;
  role: string;
  plan: string;
}

interface WorkspaceSwitcherProps {
  currentWorkspaceId?: string;
  currentRole?: string;
  workspaces: WorkspaceItem[];
}

export function WorkspaceSwitcher({
  currentWorkspaceId,
  currentRole = 'owner',
  workspaces
}: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const currentWorkspace =
    workspaces.find((w) => w.workspaceId === currentWorkspaceId) ??
    workspaces[0] ?? {
      workspaceId: 'default',
      name: 'Default Workspace',
      slug: 'default',
      role: currentRole,
      plan: 'developer'
    };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSelectWorkspace(workspaceId: string) {
    if (workspaceId === currentWorkspace.workspaceId) {
      setIsOpen(false);
      return;
    }
    setSwitching(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/select`, {
        method: 'POST'
      });
      if (res.ok) {
        setIsOpen(false);
        router.refresh();
      } else {
        alert('Failed to switch workspace. Please try again.');
      }
    } catch {
      alert('Network error switching workspace.');
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-sm font-medium text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Building2 className="w-4 h-4 text-blue-400" />
        <span className="max-w-[150px] truncate">{currentWorkspace.name}</span>
        <span className={getBadgeClassName('outline')}>
          {currentRole}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 origin-top-left rounded-xl bg-slate-900 border border-slate-800 shadow-2xl z-50 py-1.5 focus:outline-none">
          <div className="px-3 py-2 border-b border-slate-800 text-xs font-semibold text-slate-400 tracking-wider uppercase">
            Workspaces
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {workspaces.map((ws) => {
              const isSelected = ws.workspaceId === currentWorkspace.workspaceId;
              return (
                <button
                  key={ws.workspaceId}
                  onClick={() => handleSelectWorkspace(ws.workspaceId)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? 'bg-blue-600/20 text-white font-medium'
                      : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex flex-col truncate pr-2">
                    <span className="truncate">{ws.name}</span>
                    <span className="text-xs text-slate-400 font-mono">/{ws.slug}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400 capitalize">{ws.role}</span>
                    {isSelected && <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-800 pt-1.5 pb-1 px-1 space-y-0.5">
            <a
              href="/app/workspaces/new"
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-blue-400 hover:bg-slate-800/80 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Create New Workspace
            </a>
            <a
              href="/app/settings"
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-lg transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Workspace Settings & Members
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
