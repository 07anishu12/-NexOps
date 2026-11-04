import { z } from 'zod';

/** Public configuration explicitly safe to expose to browser bundles. */
export const BrowserConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  APP_URL: z.string().url(),
  API_BASE_URL: z.string().url(),
  WIDGET_CDN_URL: z.string().url()
});

export type BrowserConfig = z.infer<typeof BrowserConfigSchema>;

export function parseBrowserConfig(input: Record<string, string | undefined>): BrowserConfig {
  const result = BrowserConfigSchema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Browser configuration validation failed:\n${details}`);
  }
  return result.data;
}
