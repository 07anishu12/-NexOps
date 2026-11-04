import React from 'react';
import { getAuthenticatedSession } from '../../lib/session';
import { InviteView } from './invite-view';

interface InvitePageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function InvitePage({ searchParams }: InvitePageProps) {
  const params = await searchParams;
  const token = params.token ?? '';
  const session = await getAuthenticatedSession();

  return <InviteView token={token} session={session} />;
}
