import { createPool, assertSafeEnvironment } from './db-common.mjs';

const ids = {
  user: '11111111-1111-4111-a111-111111111111',
  workspace: '22222222-2222-4222-a222-222222222222',
  member: '33333333-3333-4333-a333-333333333333',
  agent: '44444444-4444-4444-a444-444444444444',
  tool: '55555555-5555-4555-a555-555555555555',
  account: '66666666-6666-4666-a666-666666666666'
};

assertSafeEnvironment();
const pool = createPool();
try {
  await pool.query('BEGIN');
  await pool.query(`SELECT set_config('app.current_workspace_id', $1, true)`, [ids.workspace]);
  await pool.query(
    `INSERT INTO users (id, email, name) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [ids.user, 'developer@example.invalid', 'Synthetic Developer']
  );
  await pool.query(
    `INSERT INTO workspaces (id, name, slug, owner_id, plan) VALUES ($1, $2, $3, $4, 'free')
     ON CONFLICT (id) DO NOTHING`,
    [ids.workspace, 'Synthetic Development Workspace', 'synthetic-development', ids.user]
  );
  await pool.query(
    `INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES ($1, $2, $3, 'owner')
     ON CONFLICT (workspace_id, user_id) DO NOTHING`,
    [ids.member, ids.workspace, ids.user]
  );
  await pool.query(
    `INSERT INTO agents (id, workspace_id, name, description, current_draft, created_by)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     ON CONFLICT (id) DO NOTHING`,
    [ids.agent, ids.workspace, 'Synthetic Support Agent', 'Seeded development agent', JSON.stringify({ name: 'Synthetic Support Agent', systemPrompt: 'Synthetic only' }), ids.user]
  );
  await pool.query(
    `INSERT INTO tool_definitions (id, tool_key, version, name, description, input_schema, output_schema, risk, side_effect, required_permissions)
     VALUES ($1, 'synthetic.echo', 1, 'Synthetic Echo', 'Development-only tool', '{"type":"object"}', '{"type":"object"}', 'read', 'none', '[]')
     ON CONFLICT (id) DO NOTHING`,
    [ids.tool]
  );
  await pool.query(
    `INSERT INTO credit_accounts (id, workspace_id, currency, cached_balance)
     VALUES ($1, $2, 'credits', 100)
     ON CONFLICT (workspace_id, currency) DO NOTHING`,
    [ids.account, ids.workspace]
  );
  await pool.query('COMMIT');
  console.log('Synthetic development seed applied idempotently.');
} catch (error) {
  await pool.query('ROLLBACK');
  console.error(error instanceof Error ? error.message : 'Database seed failed.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
