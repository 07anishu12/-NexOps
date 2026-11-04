import { NextResponse } from 'next/server';
import { forwardApiRequest } from '@/lib/api-client';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await forwardApiRequest(`/v1/workspaces/${id}/members/${memberId}`, {
    method: 'PATCH',
    body
  });
  return NextResponse.json(result.data, { status: result.status });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  const result = await forwardApiRequest(`/v1/workspaces/${id}/members/${memberId}`, {
    method: 'DELETE'
  });
  return NextResponse.json(result.data, { status: result.status });
}
