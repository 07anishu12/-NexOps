# Fastify API Architecture & Operational Middleware

## 1. Architectural Overview

The AgentFlow OS REST API (`apps/api`) serves as the production-grade HTTP gateway and control plane entry point for all tenant workflows, user sessions, widget interactions, worker leases, and FDE operations.

The server framework is built on **Fastify v5**, chosen for its high-throughput asynchronous execution, schema-based serialization and validation, robust plugin encapsulation model, and native testability via in-process request injection (`light-my-request`).

```
                              CLIENT REQUEST
                                     │
                                     ▼
                     ┌───────────────────────────────┐
                     │         Helmet (CSP)          │
                     │    Configurable CORS Origin   │
                     └───────────────┬───────────────┘
                                     │
                                     ▼
                     ┌───────────────────────────────┐
                     │   Request Context & Tracing   │
                     │  x-request-id / traceparent   │
                     └───────────────┬───────────────┘
                                     │
                                     ▼
                     ┌───────────────────────────────┐
                     │     Distributed Rate Limit    │
                     │     Redis Store (Fail-Open)   │
                     └───────────────┬───────────────┘
                                     │
                                     ▼
                     ┌───────────────────────────────┐
                     │   Tenant Context Resolution   │
                     │   Session / API Key / Widget  │
                     └───────────────┬───────────────┘
                                     │
              ┌──────────────────────┴──────────────────────┐
              ▼                                             ▼
   ┌───────────────────────┐                     ┌─────────────────────┐
   │ Operational Probes    │                     │ Versioned API (/v1) │
   │ /health (Liveness)    │                     │ /auth, /workspaces, │
   │ /ready (Readiness)    │                     │ /agents, /runs      │
   │ /docs (Swagger UI)    │                     │ Tenant-Protected    │
   └───────────────────────┘                     └─────────────────────┘
```

---

## 2. Server Factory & Dependency Injection

The API server strictly separates application compilation from network listener binding:

1. **`buildApp(options?: AppOptions): Promise<FastifyInstance>`** in [`apps/api/src/app.ts`](file:///Users/anny/Desktop/NexOps/apps/api/src/app.ts):
   - A pure factory function that registers plugins, routes, lifecycle hooks, and error handlers.
   - Accepts injectable dependencies (`dbClient`, `redisClient`, `config`, `logger`, `enableRateLimit`).
   - Does **not** bind to network sockets, enabling sub-millisecond in-process testing via `app.inject()`.

2. **`startServer(port?: number, host?: string): Promise<RunningServer>`** in [`apps/api/src/server.ts`](file:///Users/anny/Desktop/NexOps/apps/api/src/server.ts):
   - Resolves application configuration from environment (`@agentflow/config`).
   - Initializes PostgreSQL client pool (`@agentflow/database`) and Redis connection (`ioredis`).
   - Binds Fastify to the configured port (default: 4000) and registers clean signal traps for `SIGTERM` and `SIGINT` graceful shutdown.

---

## 3. Operational Middleware & Lifecycle Hooks

### 3.1 Request Tracing Context (`plugins/request-context.ts`)
- **Request ID (`x-request-id`)**: Extracted from client header or auto-generated (`req-${crypto.randomUUID()}`).
- **Correlation ID (`x-correlation-id`)**: Propagated across downstream calls; defaults to `requestId`.
- **W3C Distributed Tracing (`traceparent`)**: Parsed via `@agentflow/contracts` (`00-${traceId}-${spanId}-${flags}`). Formatted and emitted in response headers.
- **Timing & Structured Logging**: High-resolution start time (`process.hrtime.bigint()`) tracks total processing duration, logged via `@agentflow/observability` with credentials redacted.

### 3.2 Security Hardening (`plugins/security.ts`)
- Configured via `@fastify/helmet`:
  - Strict Content Security Policy (relaxed in non-production for Swagger UI assets).
  - `X-Content-Type-Options: nosniff`.
  - `X-Frame-Options: DENY`.
  - `Strict-Transport-Security` (maxAge: 1 year, preload, subdomains).

### 3.3 Dynamic CORS Negotiation (`plugins/cors.ts`)
- Managed via `@fastify/cors`:
  - Configurable allowlist derived from `APP_URL`, `WIDGET_CDN_URL`, and explicit origin lists.
  - Development mode allows local browser origins (`http://localhost:*`).
  - Supports credentials, exposed trace headers, and preflight `OPTIONS` caching.

### 3.4 Distributed Rate Limiting (`plugins/rate-limit.ts`)
- Backed by Redis via `@fastify/rate-limit`:
  - Dynamic key generation based on tenant identity: `tenant:${workspaceId}:${principalId}` for authenticated users, `key:${prefix}` for API keys, and `ip:${ip}` for public callers.
  - Emits standard rate-limiting headers: `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`, and `retry-after`.
  - Exceeding quota triggers a standardized `429 RATE_LIMIT_EXCEEDED` response envelope.

### 3.5 Tenant Context Resolution (`plugins/tenant-context.ts`)
Resolves incoming authentication headers against verified Stage 05 cryptographic resolvers:
1. `x-api-key` or `Authorization: Bearer af_live_...` -> `resolveApiKeyContext(db, { plaintextApiKey })`.
2. `x-widget-session` or `x-widget-token` + `Origin` -> `resolveWidgetSessionContext(db, { sessionToken, origin })`.
3. `Cookie: af_session=...` or `Authorization: Bearer sess_...` -> `resolveSessionContext(db, { sessionToken })`.
4. `x-worker-run-id` -> `resolveWorkerContext(db, { runId })`.

Decorates `request.tenantContext` as `TrustedTenantContext`. Routes requiring authentication use `fastify.requireTenantAuth(allowedRoles?)` to enforce tenancy boundaries and RBAC roles before executing business logic.

---

## 4. Standard Response & Error Envelope Model

All endpoints adhere strictly to the `@agentflow/contracts` schema envelopes:

### Success Envelope (`ApiSuccessEnvelope<T>`)
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req-9884ef7a-...",
    "correlationId": "corr-12345",
    "timestamp": "2026-11-04T16:30:00.000Z",
    "traceId": "4bf92f3577b34da6a3ce929d0e0e4736"
  }
}
```

### Error Envelope (`ApiErrorEnvelope`)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "name",
        "code": "too_small",
        "message": "String must contain at least 1 character(s)"
      }
    ]
  },
  "meta": {
    "requestId": "req-9884ef7a-...",
    "correlationId": "corr-12345",
    "timestamp": "2026-11-04T16:30:00.000Z"
  }
}
```

Standard error codes: `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `VALIDATION_ERROR` (400, 413), `CONFLICT` (409), `RATE_LIMIT_EXCEEDED` (429), and `INTERNAL_ERROR` (500). Internal details and stack traces are suppressed in production mode.
