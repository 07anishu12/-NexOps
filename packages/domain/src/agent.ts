import { AgentConfig, AgentVersion } from '@agentflow/contracts';
import { computeCanonicalPayloadHash } from './hashing.js';

export function createAgentVersionSnapshot(params: {
  id: string;
  agentId: string;
  workspaceId: string;
  versionNumber: number;
  config: AgentConfig;
  publishedBy: string;
}): AgentVersion {
  const snapshotHash = computeCanonicalPayloadHash(params.config);

  return {
    id: params.id,
    agentId: params.agentId,
    workspaceId: params.workspaceId,
    versionNumber: params.versionNumber,
    configSnapshot: params.config,
    snapshotHash,
    publishedBy: params.publishedBy,
    publishedAt: new Date().toISOString()
  };
}

export function isAllowedOrigin(origin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.length === 0) return false;
  if (allowedOrigins.includes('*')) return true;

  try {
    const normalizedTarget = new URL(origin).origin;
    return allowedOrigins.some((allowed) => {
      try {
        return new URL(allowed).origin === normalizedTarget;
      } catch {
        return allowed === origin;
      }
    });
  } catch {
    return false;
  }
}
