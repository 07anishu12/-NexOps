import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/**/*.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://agentflow:agentflow_secret@localhost:5432/agentflow_dev'
  },
  strict: true,
  verbose: true
});
