import { z } from 'zod';

export const PaginationParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

export const PaginationMetaSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
  nextCursor: z.string().optional()
});

export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

export function createPaginationMeta(params: {
  page: number;
  limit: number;
  totalItems: number;
  nextCursor?: string;
}): PaginationMeta {
  const totalPages = Math.ceil(params.totalItems / params.limit) || 1;
  return {
    page: params.page,
    limit: params.limit,
    totalItems: params.totalItems,
    totalPages,
    hasNext: params.page < totalPages,
    hasPrev: params.page > 1,
    nextCursor: params.nextCursor
  };
}

export const PaginatedResultSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    pagination: PaginationMetaSchema
  });
