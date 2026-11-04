import { NextResponse } from 'next/server';
import { forwardApiRequest } from '@/lib/api-client';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await forwardApiRequest(`/v1/workspaces/${id}/onboarding`, {
    method: 'POST',
    body
  });
  return NextResponse.json(result.data, { status: result.status });
}
