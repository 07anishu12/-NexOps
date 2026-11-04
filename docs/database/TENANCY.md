# AgentFlow OS — Multi-Tenant Architecture and Isolation Model

## 1. Principles of Tenant Isolation

AgentFlow OS is an enterprise-grade multi-tenant platform. Tenant isolation is guaranteed through **defense-in-depth**:
1. **Application-Level Authorization**: API gateway and service layers resolve authenticated tenant context from validated session cookies, API keys, or verified deployment widget sessions. Direct user-supplied `workspace_id` parameters are never trusted.
2. **PostgreSQL Row-Level Security (RLS)**: Enforced engine-level policies ensure that queries executed under the application role (`agentflow_app`) can only access data belonging to the active transaction tenant context (`app.current_workspace_id`).
3. **Relational Composite Foreign Keys**: Parent-child relationships enforce workspace scoping across tables. An entity in Workspace A cannot reference an entity in Workspace B even if its UUID is known.
4. **Worker Ownership Resolution**: Background queue workers resolve workspace ownership directly from the immutable, durable `runs` record in PostgreSQL, ignoring any tenant claims provided in queue payloads.

---

## 2. Transaction-Local Workspace Context

### 2.1 Configuration Variable
PostgreSQL's configuration setting `app.current_workspace_id` holds the active workspace UUID.
Policies evaluate this via the stable helper function:
```sql
CREATE OR REPLACE FUNCTION agentflow_current_workspace_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_workspace_id', true), '')::uuid
$$;
```

### 2.2 Connection Pool Safety
To prevent tenant context bleeding across pooled database connections, context must **always** be set with `is_local = true` inside an explicit transaction:
```sql
SELECT set_config('app.current_workspace_id', $workspace_id, true);
```
When `is_local` is `true`, PostgreSQL automatically clears `app.current_workspace_id` upon `COMMIT` or `ROLLBACK`. The next transaction borrowing the physical connection starts with an empty tenant context.

In TypeScript (`@agentflow/database`):
```typescript
await withWorkspaceTransaction(client, context, async (tx) => {
  // Queries executed here are automatically isolated to context.workspaceId
  const myAgents = await tx.query.agents.findMany();
});
```

---

## 3. Row-Level Security Policies

All 44 workspace-scoped tables enforce RLS:
```sql
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents FORCE ROW LEVEL SECURITY;

CREATE POLICY agentflow_workspace_isolation ON public.agents
  USING (workspace_id = agentflow_current_workspace_id())
  WITH CHECK (workspace_id = agentflow_current_workspace_id());
```

For the root `workspaces` table:
```sql
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces FORCE ROW LEVEL SECURITY;

CREATE POLICY agentflow_workspace_isolation ON public.workspaces
  USING (id = agentflow_current_workspace_id())
  WITH CHECK (id = agentflow_current_workspace_id());
```

### 3.1 Restricted Application Role
Database connections from backend services operate under the least-privilege role:
- Role: `agentflow_app` (`NOLOGIN`).
- Granted `SELECT, INSERT, UPDATE, DELETE` on public tables.
- Granted `USAGE, SELECT` on sequences.
- Prohibited from `ALTER`, `DROP`, `TRUNCATE`, or bypassing RLS.

---

## 4. Composite Foreign Keys

Hierarchical entities use composite unique constraints and foreign keys to prevent cross-tenant parent references:
```sql
-- Parent table has composite unique constraint
ALTER TABLE agents ADD CONSTRAINT agents_workspace_id_unique UNIQUE (workspace_id, id);

-- Child table references both columns
ALTER TABLE agent_versions
  ADD CONSTRAINT agent_versions_workspace_agent_fk
  FOREIGN KEY (workspace_id, agent_id)
  REFERENCES agents (workspace_id, id);
```

If an attacker attempts to insert an `agent_version` with `workspace_id = Alpha` and `agent_id = Beta`, the database rejects the insert immediately with a foreign key violation (`55000 / 23503`).

---

## 5. Background Worker Security

When BullMQ worker jobs are processed:
1. The worker receives `{ runId }`.
2. The worker connects to PostgreSQL and fetches the run root record:
   ```sql
   SELECT workspace_id, agent_version_id, deployment_id FROM runs WHERE id = $runId;
   ```
3. The worker establishes `WorkspaceContext` using the database-persisted `workspace_id`.
4. All subsequent step execution, tool invocations, and checkpoint persistence execute inside `withWorkspaceTransaction`.

Queue payloads never dictate workspace ownership.

---

## 6. Tenant Isolation Test Suite

Integration tests in `packages/database/tests/database-integration.test.ts` verify:
1. **Cross-Tenant Read**: Workspace Alpha cannot read Beta's records.
2. **Guessed ID Protection**: Direct `WHERE id = $betaId` queries under Alpha context return 0 rows.
3. **Cross-Tenant Write**: Alpha `UPDATE` or `DELETE` targeting Beta IDs affects 0 rows.
4. **Fail Closed**: Queries with unconfigured or empty `app.current_workspace_id` return 0 rows.
5. **Composite FK Enforcement**: Insertion of mismatched workspace/parent IDs fails foreign key checks.
6. **Pool Bleed Prevention**: Consecutive transactions alternating workspaces do not retain prior state.
