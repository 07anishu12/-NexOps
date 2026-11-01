export interface TraceContext {
  traceId: string;
  spanId: string;
  sampled: boolean;
}

export function generateTraceId(): string {
  // Generate a random 16-byte hex string (32 chars) for traceId
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateSpanId(): string {
  // Generate a random 8-byte hex string (16 chars) for spanId
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function createTraceContext(traceId?: string): TraceContext {
  return {
    traceId: traceId ?? generateTraceId(),
    spanId: generateSpanId(),
    sampled: true
  };
}
