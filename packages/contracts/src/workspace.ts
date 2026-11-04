import { z } from 'zod';
import { IdSchema, TimestampSchema } from './common.js';
import { UserRoleSchema, type UserRole } from './user.js';

export const WorkspaceRoleSchema = UserRoleSchema;
export type WorkspaceRole = UserRole;

export const ActiveWorkspaceRoleSchema = z.enum([
  'owner',
  'admin',
  'developer',
  'operator',
  'viewer'
]);
export type ActiveWorkspaceRole = z.infer<typeof ActiveWorkspaceRoleSchema>;

export const WorkspaceSchema = z.object({
  id: IdSchema,
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric lowercase with hyphens'),
  ownerId: IdSchema,
  plan: z.enum(['free', 'pro', 'team', 'enterprise']).default('free'),
  timezone: z.string().max(50).default('UTC'),
  locale: z.string().max(20).default('en'),
  status: z.enum(['active', 'archived', 'suspended']).default('active'),
  onboardingCompleted: z.boolean().default(false),
  onboardingIntent: z.record(z.string(), z.unknown()).default({}),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema
});

export type Workspace = z.infer<typeof WorkspaceSchema>;

export const CreateWorkspaceSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric lowercase with hyphens').optional(),
  timezone: z.string().max(50).optional(),
  locale: z.string().max(20).optional()
});

export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;

export const UpdateWorkspaceSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  timezone: z.string().max(50).optional(),
  locale: z.string().max(20).optional(),
  status: z.enum(['active', 'archived']).optional()
});

export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceSchema>;

export const WorkspaceMemberSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  userId: IdSchema,
  role: WorkspaceRoleSchema,
  createdAt: TimestampSchema
});

export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;

export const UpdateMemberRoleSchema = z.object({
  role: ActiveWorkspaceRoleSchema
});

export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;

export const CreateInvitationSchema = z.object({
  email: z.string().email('Valid email address required'),
  role: ActiveWorkspaceRoleSchema
});

export type CreateInvitationInput = z.infer<typeof CreateInvitationSchema>;

export const AcceptInvitationSchema = z.object({
  token: z.string().min(10, 'Invitation token required')
});

export type AcceptInvitationInput = z.infer<typeof AcceptInvitationSchema>;

export const WorkspaceOnboardingSchema = z.object({
  useCase: z.string().min(2, 'Use case must be specified').max(100),
  targetChannels: z.array(z.string()).optional(),
  skippedIntegrations: z.boolean().optional()
});

export type WorkspaceOnboardingInput = z.infer<typeof WorkspaceOnboardingSchema>;

export const TransferOwnershipSchema = z.object({
  newOwnerUserId: IdSchema
});

export type TransferOwnershipInput = z.infer<typeof TransferOwnershipSchema>;
