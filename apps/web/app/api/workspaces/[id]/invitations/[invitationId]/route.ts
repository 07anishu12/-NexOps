import { NextResponse } from 'next/server';
import { forwardApiRequest } from '@/lib/api-client';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; invitationId: string }> }
) {
  const { id, invitationId } = await params;
  const result = await forwardApiRequest(`/v1/workspaces/${id}/invitations/${invitationId}`, {
    method: 'DELETE'
  });
  return NextResponse.json(result.data, { status: result.status });
}
