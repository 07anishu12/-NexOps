import { and, eq, isNull } from 'drizzle-orm';
import { integrationConnections, encryptedCredentials } from '../schema/index.js';
import { isWorkspaceUser, WorkspaceContext } from '../tenant-context.js';
import { BaseRepository } from './base.js';

export class IntegrationRepository extends BaseRepository {
  async listConnections(
    context: WorkspaceContext,
    filters?: { provider?: any; status?: any }
  ) {
    return this.withScopedTransaction(context, 'integration:manage', async (tx) => {
      const conditions = [eq(integrationConnections.workspaceId, context.workspaceId)];
      if (filters?.provider) conditions.push(eq(integrationConnections.provider, filters.provider));
      if (filters?.status) conditions.push(eq(integrationConnections.status, filters.status));

      // Typed projection: NEVER returns credential ciphertexts or secrets
      return tx
        .select({
          id: integrationConnections.id,
          workspaceId: integrationConnections.workspaceId,
          provider: integrationConnections.provider,
          externalAccountRef: integrationConnections.externalAccountRef,
          displayName: integrationConnections.displayName,
          grantedScopes: integrationConnections.grantedScopes,
          status: integrationConnections.status,
          tokenExpiresAt: integrationConnections.tokenExpiresAt,
          lastHealthCheckAt: integrationConnections.lastHealthCheckAt,
          createdAt: integrationConnections.createdAt
        })
        .from(integrationConnections)
        .where(and(...conditions));
    });
  }

  async findConnectionById(context: WorkspaceContext, id: string) {
    return this.withScopedTransaction(context, 'integration:manage', async (tx) => {
      const [connection] = await tx
        .select({
          id: integrationConnections.id,
          workspaceId: integrationConnections.workspaceId,
          provider: integrationConnections.provider,
          externalAccountRef: integrationConnections.externalAccountRef,
          displayName: integrationConnections.displayName,
          grantedScopes: integrationConnections.grantedScopes,
          status: integrationConnections.status,
          tokenExpiresAt: integrationConnections.tokenExpiresAt,
          lastHealthCheckAt: integrationConnections.lastHealthCheckAt,
          createdAt: integrationConnections.createdAt
        })
        .from(integrationConnections)
        .where(
          and(
            eq(integrationConnections.workspaceId, context.workspaceId),
            eq(integrationConnections.id, id)
          )
        )
        .limit(1);

      return this.notFoundIfNull(connection, 'IntegrationConnection', id);
    });
  }

  async createConnection(
    context: WorkspaceContext,
    input: {
      provider: any;
      externalAccountRef: string;
      displayName?: string;
      grantedScopes?: string[];
      status?: any;
    }
  ) {
    return this.withScopedTransaction(context, 'integration:manage', async (tx) => {
      const connectorId = isWorkspaceUser(context) ? context.userId : context.workspaceId;

      const [created] = await tx
        .insert(integrationConnections)
        .values({
          workspaceId: context.workspaceId,
          provider: input.provider,
          externalAccountRef: input.externalAccountRef,
          displayName: input.displayName,
          grantedScopes: input.grantedScopes ?? [],
          status: input.status ?? 'pending',
          connectedBy: connectorId
        })
        .returning();

      return created;
    });
  }

  async storeEncryptedCredentials(
    context: WorkspaceContext,
    input: {
      connectionId: string;
      ciphertext: string;
      iv: string;
      authTag: string;
      keyReference: string;
      keyVersion: string;
    }
  ) {
    return this.withScopedTransaction(context, 'integration:manage', async (tx) => {
      // 1. Verify connection ownership in same workspace
      await this.findConnectionById(context, input.connectionId);

      const [stored] = await tx
        .insert(encryptedCredentials)
        .values({
          workspaceId: context.workspaceId,
          connectionId: input.connectionId,
          ciphertext: input.ciphertext,
          iv: input.iv,
          authTag: input.authTag,
          keyReference: input.keyReference,
          keyVersion: input.keyVersion
        })
        .returning({
          id: encryptedCredentials.id,
          connectionId: encryptedCredentials.connectionId,
          keyReference: encryptedCredentials.keyReference,
          keyVersion: encryptedCredentials.keyVersion,
          encryptedAt: encryptedCredentials.encryptedAt
        });

      return stored;
    });
  }

  async findEncryptedCredentials(context: WorkspaceContext, connectionId: string) {
    return this.withScopedTransaction(context, 'integration:manage', async (tx) => {
      // Must verify connection in workspace first
      await this.findConnectionById(context, connectionId);

      const [creds] = await tx
        .select()
        .from(encryptedCredentials)
        .where(
          and(
            eq(encryptedCredentials.workspaceId, context.workspaceId),
            eq(encryptedCredentials.connectionId, connectionId),
            isNull(encryptedCredentials.revokedAt)
          )
        )
        .limit(1);

      return this.notFoundIfNull(creds, 'EncryptedCredentials', connectionId);
    });
  }
}
