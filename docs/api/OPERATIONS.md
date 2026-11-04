# Fastify API Operations & Runbook

## 1. Service Operation & Commands

### Running Locally
```bash
# Build API package
pnpm --filter @agentflow/api build

# Start API service on port 4000
pnpm --filter @agentflow/api start

# Typecheck and run tests
pnpm --filter @agentflow/api typecheck
pnpm --filter @agentflow/api test
```

---

## 2. Configuration & Environment Variables

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Number | `4000` | Port for Fastify HTTP listener |
| `HOST` | String | `0.0.0.0` | Binding interface host |
| `NODE_ENV` | Enum | `development` | Runtime environment (`development`, `test`, `staging`, `production`) |
| `DATABASE_URL` | URL | `postgresql://...` | PostgreSQL connection string |
| `REDIS_URL` | URL | `redis://localhost:6379/0` | Redis connection string for distributed rate limiting |
| `APP_URL` | URL | `http://localhost:3000` | Frontend web URL (used for CORS allowlist) |
| `WIDGET_CDN_URL` | URL | `http://localhost:3002` | Public chat widget CDN URL (used for CORS allowlist) |
| `LOG_LEVEL` | Enum | `info` | Minimum log level (`debug`, `info`, `warn`, `error`) |
| `DEFAULT_PUBLIC_RATE_LIMIT`| Number | `60` | Maximum requests per minute per IP on public endpoints |
| `MAX_ATTACHMENT_BYTES` | Number | `10485760` (10MB) | Maximum payload body limit before rejecting with 413 |
| `DEFAULT_RUN_TIMEOUT_SECONDS` | Number | `120` | Server request timeout duration |

---

## 3. Operational Probes (Liveness & Readiness)

### Liveness Probe: `GET /health`
- **Purpose**: Verify that the Node.js event loop and Fastify HTTP listener are active.
- **Response**: `200 OK`
  ```json
  {
    "status": "ok",
    "service": "api",
    "version": "0.1.0",
    "environment": "development",
    "timestamp": "2026-11-04T16:30:00.000Z"
  }
  ```
- **Kubernetes / ECS Config**:
  ```yaml
  livenessProbe:
    httpGet:
      path: /health
      port: 4000
    initialDelaySeconds: 5
    periodSeconds: 10
  ```

### Readiness Probe: `GET /ready`
- **Purpose**: Verify that all critical backend dependencies (PostgreSQL pool and Redis cache) are reachable before routing client traffic.
- **Healthy Response**: `200 OK`
  ```json
  {
    "status": "ready",
    "dependencies": {
      "database": "up",
      "redis": "up"
    },
    "timestamp": "2026-11-04T16:30:00.000Z"
  }
  ```
- **Degraded Response**: `503 Service Unavailable`
  ```json
  {
    "status": "degraded",
    "dependencies": {
      "database": "down",
      "redis": "up"
    },
    "errors": {
      "database": "Connection refused to host:5432"
    },
    "timestamp": "2026-11-04T16:30:00.000Z"
  }
  ```
- **Kubernetes / ECS Config**:
  ```yaml
  readinessProbe:
    httpGet:
      path: /ready
      port: 4000
    initialDelaySeconds: 10
    periodSeconds: 5
    failureThreshold: 3
  ```

---

## 4. Distributed Rate Limiting Operations

Rate limiting is enforced via `@fastify/rate-limit` connected to Redis:
- Standard response headers:
  - `x-ratelimit-limit`: Maximum allowed requests in the time window (default: 60/min).
  - `x-ratelimit-remaining`: Requests remaining in the current window.
  - `x-ratelimit-reset`: Unix timestamp when the window resets.
  - `retry-after`: Seconds to wait before retrying when quota is exhausted.
- **Fail-Open Policy**: If Redis becomes temporarily unreachable, rate limiting fails open gracefully to in-memory tracking without rejecting valid user traffic, while emitting diagnostic warning logs.

---

## 5. Graceful Shutdown & Signal Trapping

When orchestrators (Kubernetes, Docker, ECS) scale down or deploy a new version, they send `SIGTERM` followed by `SIGINT`:
1. The process intercepts `SIGTERM` / `SIGINT`.
2. Fastify calls `app.close()`, refusing new TCP connections and draining active in-flight HTTP requests.
3. The Redis client invokes `redisClient.quit()`.
4. The PostgreSQL connection pool invokes `dbClient.pool.end()`.
5. The process logs successful shutdown and exits cleanly with exit code 0.
