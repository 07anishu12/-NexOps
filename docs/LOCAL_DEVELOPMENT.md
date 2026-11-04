# Local Development

This guide starts the AgentFlow OS local dependencies without requiring provider credentials. Google, Meta, Razorpay and model-provider credentials are optional until their integrations are implemented and configured.

## Prerequisites

- Node.js 20 or newer
- pnpm 12.8.1 (the version pinned in `package.json`)
- Docker Desktop or Docker Engine with Docker Compose v2

Check the tools:

```bash
node --version
pnpm --version
docker --version
docker compose version
```

## Service architecture and ports

All services use the dedicated `agentflow-local` Docker network and named volumes. Ports bind to `127.0.0.1` only.

| Service | Container | Local URL/port | Persistent volume | Readiness check |
| --- | --- | --- | --- | --- |
| PostgreSQL | `postgres` | `localhost:5432` | `agentflow-postgres-data` | `pg_isready` |
| Redis | `redis` | `localhost:6379` | `agentflow-redis-data` | `redis-cli ping` |
| MinIO API | `minio` | http://localhost:9000 | `agentflow-minio-data` | `/minio/health/live` |
| MinIO console | `minio` | http://localhost:9001 | `agentflow-minio-data` | Console login |

The Compose file uses pinned image tags. The current MinIO-compatible images are `bitnamilegacy/minio:2024.10.29` and `bitnamilegacy/minio-client:2024.10.29`; `minio-init` waits for MinIO health, creates the configured bucket with `--ignore-existing`, and verifies it using the configured credentials.

Application URLs after the relevant app is started:

- Web control plane: http://localhost:3000
- API health: http://localhost:4000/health
- Worker health: http://localhost:4001/health
- Widget bundle preview: http://localhost:3002/agentflow-widget.js
- Documentation: http://localhost:3003/docs

## Bootstrap

From a clean checkout:

```bash
pnpm install --frozen-lockfile
pnpm dev:setup
pnpm infra:up
pnpm build
```

`pnpm dev:setup` copies `.env.example` only when `.env` is absent. It generates local PostgreSQL, session, encryption-reference and object-storage values without printing them. Existing `.env` files are preserved.

`pnpm infra:up` starts the services and performs bounded readiness checks. It verifies PostgreSQL accepts connections, Redis returns `PONG`, MinIO's API is live, and the bucket can be created/read with the configured credentials.

## Environment variables

The committed `.env.example` documents the complete local inventory. The infrastructure variables are:

```dotenv
POSTGRES_DB=agentflow_dev
POSTGRES_USER=agentflow
POSTGRES_PASSWORD=agentflow_secret
DATABASE_URL=postgresql://agentflow:agentflow_secret@localhost:5432/agentflow_dev
REDIS_URL=redis://localhost:6379/0
OBJECT_STORAGE_ENDPOINT=http://localhost:9000
OBJECT_STORAGE_BUCKET=agentflow-assets
OBJECT_STORAGE_ACCESS_KEY=agentflowlocal
OBJECT_STORAGE_SECRET_KEY=agentflowlocal-secret
```

Server processes validate their full configuration at startup. Browser configuration is limited to public URLs and environment name; server secrets are never part of the browser configuration export. Provider-specific credentials remain optional for local infrastructure.

## Connections

- PostgreSQL: use `DATABASE_URL` with a PostgreSQL client. The database name, user and password are the matching `POSTGRES_*` values.
- Redis: use `REDIS_URL`. Redis uses append-only persistence and a bounded local memory policy suitable for future BullMQ queues.
- MinIO: use `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_ACCESS_KEY`, `OBJECT_STORAGE_SECRET_KEY` and `OBJECT_STORAGE_BUCKET`. The web console is at http://localhost:9001.

No credentials are printed by the setup, readiness or failure messages.

## Common commands

```bash
pnpm infra:up       # start and wait for all services
pnpm infra:wait     # re-run bounded readiness checks
pnpm infra:status   # show Compose service status
pnpm infra:logs     # show the last 100 lines for each service
pnpm infra:down     # stop services and retain named volumes
```

Run an individual application after building:

```bash
pnpm --filter @agentflow/web dev
pnpm --filter @agentflow/api start
pnpm --filter @agentflow/worker start
pnpm --filter @agentflow/docs start
```

Database migrations are intentionally not part of this stage. Run them here once the Stage 04 PostgreSQL schema and Drizzle migration baseline is available.

## Reset procedure

Reset removes all local PostgreSQL, Redis and MinIO data, recreates the services, and waits for readiness:

```bash
pnpm dev:reset --confirm
```

The command refuses to run without `--confirm` and refuses `staging` or `production` values in `.env`. Do not use it when local data must be retained.

## Troubleshooting

### Docker daemon unavailable

Start Docker Desktop or the configured Docker daemon, then run:

```bash
pnpm infra:wait
```

The command does not claim health until the daemon and all probes respond.

### Port occupied

Set alternative local ports in `.env` (`POSTGRES_PORT`, `REDIS_PORT`, `MINIO_API_PORT`, `MINIO_CONSOLE_PORT`), then recreate the containers:

```bash
pnpm infra:down
pnpm infra:up
```

### Bucket initialization failed

Check MinIO logs and retry the idempotent initializer:

```bash
pnpm infra:logs
pnpm infra:wait
```

### Configuration validation failed

Check the variable names and URL schemes in `.env`. Errors report variable names and validation messages, never secret values. Run `pnpm dev:setup` only after moving an unwanted `.env`; setup intentionally never overwrites it.
