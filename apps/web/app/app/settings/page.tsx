import React from 'react';
import { redirect } from 'next/navigation';
import { getAuthenticatedSession } from '../../../lib/session';
import { WorkspaceSettingsView } from './settings-view';

export default async function SettingsPage() {
  const session = await getAuthenticatedSession();

  if (!session) {
    redirect('/login?returnTo=/app/settings');
  }

  const activeWorkspace = session.workspaces.find(
    (w) => w.workspaceId === session.activeWorkspace?.workspaceId
  ) ?? session.workspaces[0];

  return (
    <WorkspaceSettingsView
      session={session}
      activeWorkspace={activeWorkspace}
    />
  );
}
