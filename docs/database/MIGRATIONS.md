# AgentFlow OS — Database Migration & Baseline Management

## 1. Migration Tooling & Commands

The `@agentflow/database` package provides unified CLI scripts for schema evolution and database management:

| Command | Script | Description |
| :--- | :--- | :--- |
| `pnpm --filter @agentflow/database db:generate` | `drizzle-kit generate` | Generates a new migration SQL file from schema diffs. |
| `pnpm --filter @agentflow/database db:migrate` | `scripts/db-migrate.mjs` | Executes pending migrations against `DATABASE_URL`. |
| `pnpm --filter @agentflow/database db:status` | `scripts/db-status.mjs` | Prints applied migrations recorded in `drizzle.__drizzle_migrations`. |
| `pnpm --filter @agentflow/database db:check` | `scripts/db-check.mjs` | Validates that all 48 tables and 44 RLS policies are active. |
| `pnpm --filter @agentflow/database db:seed` | `scripts/db-seed.mjs` | Seeds idempotent synthetic development data (blocked in prod/staging). |
| `pnpm --filter @agentflow/database db:rollback` | `scripts/db-rollback.mjs` | Intentionally blocks automated rollback, enforcing forward fixes. |

---

## 2. Baseline Reconciliation

### 2.1 Historical Baseline
- No legacy `database/001_initial_schema.sql` file exists in the repository.
- The authoritative baseline is established by Drizzle migrations:
  - `0000_productive_exiles.sql`: 983 lines defining all 33 PostgreSQL enums, 48 tables, composite unique keys, foreign keys, and check constraints.
  - `0001_tenant_security.sql`: 67 lines establishing role `agentflow_app`, RLS enablement and force on 44 tables, tenant isolation policies, and append-only immutability triggers.

### 2.2 Migration Tracking
Migrations are tracked in PostgreSQL schema `drizzle` under table `__drizzle_migrations`:
- `id`: integer sequence.
- `hash`: SHA-256 hash of migration file content.
- `created_at`: epoch millisecond timestamp string.

---

## 3. Forward-Fix Strategy vs. Rollback

### 3.1 Policy
In production and staging environments, **automatic down-migrations / destructive rollbacks are strictly prohibited**.
- Rolling back database schemas in multi-tenant environments causes permanent data loss, breaks ongoing worker leases, and disrupts idempotency tracking.
- Schema changes must be backwards-compatible (expand-and-contract pattern):
  1. **Phase 1 (Expand)**: Add new nullable columns, tables, or indexes. Old and new application versions function simultaneously.
  2. **Phase 2 (Migrate)**: Backfill data and switch application reads/writes to new structures.
  3. **Phase 3 (Contract)**: Drop deprecated columns or constraints in a subsequent scheduled migration.

### 3.2 Recovery from Failed Migrations
If an unexpected migration error occurs:
1. Identify the root cause from migration error logs.
2. Author an additive, reviewed **forward-fix migration** (`db:generate` or manual migration SQL).
3. Apply the forward-fix via `db:migrate`.
4. For disposable local development environments only, reset the local container using:
   ```bash
   pnpm dev:reset --confirm
   pnpm infra:up
   pnpm --filter @agentflow/database db:migrate
   pnpm --filter @agentflow/database db:seed
   ```

---

## 4. Development Seeding

The seed script (`scripts/db-seed.mjs`) populates deterministic, synthetic development records:
- Synthetic user (`11111111-1111-4111-a111-111111111111`).
- Synthetic workspace (`22222222-2222-4222-a222-222222222222`) with slug `synthetic-development`.
- Workspace membership with role `owner`.
- Example agent (`Synthetic Support Agent`) with valid JSON draft configuration.
- Synthetic tool definition (`synthetic.echo`).
- Credit account with 100 test credits.

### Safety Guarantee
- `assertSafeEnvironment()` blocks execution whenever `NODE_ENV` is `production` or `staging`.
- All seed statements use `ON CONFLICT DO NOTHING`, making repeated runs safe and idempotent.
- Real credentials, API keys, or customer PII are strictly excluded.
