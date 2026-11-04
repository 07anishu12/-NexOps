import { NextResponse } from 'next/server';
import { forwardApiRequest } from '@/lib/api-client';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await forwardApiRequest(`/v1/workspaces/${id}/select`, {
    method: 'POST'
  });
  return NextResponse.json(result.data, { status: result.status });
}
