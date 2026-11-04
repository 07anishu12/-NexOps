import { NextResponse } from 'next/server';
import { forwardApiRequest } from '@/lib/api-client';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = await forwardApiRequest('/v1/workspaces/invitations/accept', {
    method: 'POST',
    body
  });
  return NextResponse.json(result.data, { status: result.status });
}
