import { createPool } from './db-common.mjs';

const expectedTables = [
  'users', 'oauth_accounts', 'sessions', 'workspaces', 'workspace_members', 'workspace_invitations',
  'agents', 'agent_versions', 'agent_evaluation_suites', 'agent_evaluation_cases', 'agent_evaluation_results',
  'tool_definitions', 'agent_version_tools', 'integration_connections', 'encrypted_credentials',
  'deployments', 'deployment_origins', 'deployment_releases', 'api_keys', 'widget_sessions',
  'conversations', 'messages', 'runs', 'run_steps', 'run_events', 'tool_operations', 'approvals', 'approval_events',
  'workflows', 'workflow_versions', 'workflow_triggers', 'workflow_runs', 'knowledge_sources', 'knowledge_chunks',
  'credit_accounts', 'credit_ledger_entries', 'credit_reservations', 'usage_events', 'payment_orders', 'payment_events',
  'webhook_endpoints', 'webhook_deliveries', 'audit_events', 'notifications', 'fde_implementation_records',
  'deployment_readiness_reports', 'deployment_readiness_checks', 'support_access_grants'
];

const pool = createPool();
try {
  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  const actual = new Set(tables.rows.map((row) => row.table_name));
  const missing = expectedTables.filter((table) => !actual.has(table));
  const rls = await pool.query(
    `SELECT count(*)::int AS count FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relrowsecurity = true`
  );
  if (missing.length > 0) throw new Error(`Missing database tables: ${missing.join(', ')}`);
  if (rls.rows[0].count < 40) throw new Error(`Expected forced RLS on workspace tables; found ${rls.rows[0].count}`);
  console.log(`Database check passed: ${actual.size} public tables, ${rls.rows[0].count} RLS-enabled tables.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Database check failed.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
