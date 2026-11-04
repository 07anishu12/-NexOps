import { z } from 'zod';
import { IdSchema, TimestampSchema } from './common.js';

export const UserRoleSchema = z.enum([
  'owner',
  'admin',
  'developer',
  'operator',
  'viewer',
  'member'
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: IdSchema,
  email: z.string().email(),
  name: z.string().min(1).max(255),
  avatarUrl: z.string().url().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema
});

export type User = z.infer<typeof UserSchema>;
