import { NextResponse } from 'next/server';
import { forwardApiRequest } from '@/lib/api-client';

export async function GET() {
  const result = await forwardApiRequest('/v1/workspaces');
  return NextResponse.json(result.data, { status: result.status });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = await forwardApiRequest('/v1/workspaces', {
    method: 'POST',
    body
  });
  return NextResponse.json(result.data, { status: result.status });
}
