import { z } from 'zod';
import { IdSchema, TimestampSchema } from './common.js';
import { UserRoleSchema, type UserRole } from './user.js';

export const WorkspaceRoleSchema = UserRoleSchema;
export type WorkspaceRole = UserRole;

export const WorkspaceSchema = z.object({
  id: IdSchema,
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric lowercase with hyphens'),
  ownerId: IdSchema,
  plan: z.enum(['free', 'pro', 'team', 'enterprise']).default('free'),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema
});

export type Workspace = z.infer<typeof WorkspaceSchema>;

export const WorkspaceMemberSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  userId: IdSchema,
  role: WorkspaceRoleSchema,
  createdAt: TimestampSchema
});

export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;
