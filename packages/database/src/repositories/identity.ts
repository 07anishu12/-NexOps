import { and, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import type { DatabaseClient } from '../client.js';
import { users, workspaces, workspaceMembers, oauthAccounts } from '../schema/index.js';
import { AuthenticationError } from '../tenant-context.js';

export interface GoogleIdentityProfile {
  providerSubject: string;
  email: string;
  name: string;
  avatarUrl?: string;
  emailVerified: boolean;
}

export interface ResolvedIdentity {
  user: typeof users.$inferSelect;
  oauthAccount: typeof oauthAccounts.$inferSelect;
  defaultWorkspaceId?: string;
  isNewUser: boolean;
}

export class IdentityRepository {
  constructor(private readonly client: DatabaseClient) {}

  async findUserById(userId: string) {
    const [user] = await this.client.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user ?? null;
  }

  async findUserByEmail(email: string) {
    const [user] = await this.client.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);
    return user ?? null;
  }

  async findOAuthAccount(provider: string, providerSubject: string) {
    const [account] = await this.client.db
      .select()
      .from(oauthAccounts)
      .where(
        and(
          eq(oauthAccounts.provider, provider),
          eq(oauthAccounts.providerSubject, providerSubject)
        )
      )
      .limit(1);
    return account ?? null;
  }

  async getUserWorkspaces(userId: string) {
    return this.client.db
      .select({
        workspaceId: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        role: workspaceMembers.role,
        plan: workspaces.plan
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, userId));
  }

  /**
   * Transaction-safe, idempotent user resolution or provisioning from verified Google claims.
   * Prevents unauthenticated email-based account merging.
   */
  async findOrCreateUserFromGoogle(profile: GoogleIdentityProfile): Promise<ResolvedIdentity> {
    const email = profile.email.toLowerCase().trim();

    // Enforce email verification status before identity creation
    if (!profile.emailVerified) {
      throw new AuthenticationError('Google account email is not verified');
    }

    if (!profile.providerSubject || profile.providerSubject.trim().length === 0) {
      throw new AuthenticationError('Missing Google provider subject');
    }

    // Execute in an atomic transaction to prevent race conditions on concurrent first login
    return this.client.db.transaction(async (tx) => {
      // 1. Look up existing oauth account by stable provider subject
      const [existingOauth] = await tx
        .select()
        .from(oauthAccounts)
        .where(
          and(
            eq(oauthAccounts.provider, 'google'),
            eq(oauthAccounts.providerSubject, profile.providerSubject)
          )
        )
        .limit(1);

      if (existingOauth) {
        // Returning user with verified Google connection
        const [existingUser] = await tx
          .select()
          .from(users)
          .where(eq(users.id, existingOauth.userId))
          .limit(1);

        if (!existingUser) {
          throw new AuthenticationError('User record associated with OAuth account not found');
        }

        // Optionally refresh avatar or name if changed
        if (profile.avatarUrl && profile.avatarUrl !== existingUser.avatarUrl) {
          await tx
            .update(users)
            .set({ avatarUrl: profile.avatarUrl, updatedAt: new Date() })
            .where(eq(users.id, existingUser.id));
        }

        // Resolve user's active workspace
        const members = await tx
          .select({ workspaceId: workspaceMembers.workspaceId })
          .from(workspaceMembers)
          .where(eq(workspaceMembers.userId, existingUser.id))
          .limit(1);

        return {
          user: existingUser,
          oauthAccount: existingOauth,
          defaultWorkspaceId: members[0]?.workspaceId,
          isNewUser: false
        };
      }

      // 2. Oauth account does not exist. Check for collision on existing email
      const [existingEmailUser] = await tx
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingEmailUser) {
        // Refuse automatic account merge based on email match
        throw new AuthenticationError(
          'An account with this email already exists. To sign in with Google, please link your Google account from your account settings.'
        );
      }

      // 3. New User Provisioning
      const [newUser] = await tx
        .insert(users)
        .values({
          email,
          name: profile.name || email.split('@')[0] || 'User',
          avatarUrl: profile.avatarUrl ?? null
        })
        .returning();

      if (!newUser) {
        throw new Error('Failed to insert user record');
      }

      // 4. Link OAuth Account
      const [newOauth] = await tx
        .insert(oauthAccounts)
        .values({
          userId: newUser.id,
          provider: 'google',
          providerSubject: profile.providerSubject,
          providerEmail: email,
          grantedScopes: ['openid', 'email', 'profile']
        })
        .returning();

      if (!newOauth) {
        throw new Error('Failed to insert oauth account record');
      }

      // 5. Create default personal workspace
      const rawSlug = (
        profile.name.toLowerCase().replace(/[^a-z0-9]/g, '-') +
        '-' +
        randomBytes(3).toString('hex')
      )
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);

      const slug = rawSlug.length >= 3 ? rawSlug : `ws-${randomBytes(4).toString('hex')}`;

      const [newWorkspace] = await tx
        .insert(workspaces)
        .values({
          name: `${newUser.name}'s Workspace`,
          slug,
          ownerId: newUser.id,
          plan: 'free'
        })
        .returning();

      if (!newWorkspace) {
        throw new Error('Failed to insert workspace record');
      }

      // 6. Add user as workspace owner
      await tx.insert(workspaceMembers).values({
        workspaceId: newWorkspace.id,
        userId: newUser.id,
        role: 'owner'
      });

      return {
        user: newUser,
        oauthAccount: newOauth,
        defaultWorkspaceId: newWorkspace.id,
        isNewUser: true
      };
    });
  }
}
