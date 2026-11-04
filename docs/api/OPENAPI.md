# OpenAPI 3.0 Specification & Interactive Documentation

## 1. Specification Overview

The AgentFlow OS REST API automatically compiles and publishes an OpenAPI 3.0.3 specification generated directly from route definitions, parameter schemas, and `@agentflow/contracts` data types.

- **Interactive Documentation UI**: `http://localhost:4000/docs` (rendered via Swagger UI).
- **Raw OpenAPI JSON Specification**: `http://localhost:4000/docs/json`.

---

## 2. Security Schemes

The OpenAPI specification documents four primary authentication mechanisms:

| Scheme Name | Type | In | Description | Format / Prefix |
| :--- | :--- | :--- | :--- | :--- |
| `apiKeyAuth` | `apiKey` | `header` | API key authentication via `x-api-key` header | `af_live_...` or `af_test_...` |
| `bearerApiKey` | `http` | `header` | API key authentication via `Authorization: Bearer <token>` | `af_live_...` or `af_test_...` |
| `sessionAuth` | `apiKey` | `cookie` | Web session cookie authentication | `af_session=<cookie>` |
| `widgetSession` | `apiKey` | `header` | Public widget session token via `x-widget-session` | `token` + verified `Origin` |

---

## 3. Tag Organization

The API is organized into functional domain tags:

1. **`System`**: Operational health probes, readiness checks, and versioned root discovery.
   - `GET /`: Root discovery metadata.
   - `GET /health`: Liveness probe.
   - `GET /ready`: Dependency readiness probe (PostgreSQL & Redis).
   - `GET /v1`: Versioned root discovery.
   - `GET /v1/health`: Backward compatibility health probe.
2. **`Auth`**: Tenant profile, session introspection, and principal resolution.
   - `GET /v1/auth/me`: Inspect authenticated tenant context and claims.
3. **`Workspaces`**: Workspace-level metadata and tenancy boundaries.
   - `GET /v1/workspaces/current`: Tenant-scoped workspace details.
4. **`Agents`**: Agent lifecycle and configuration validation.
   - `POST /v1/agents/validate`: Validate agent definition payloads against contract schemas.
5. **`Runs`**: Durable workflow and agent execution submissions.
   - `POST /v1/runs/validate`: Validate run execution payloads.
6. **`Integrations`**: External provider integrations and metadata.
   - `GET /v1/integrations/providers`: List supported platform integrations (Meta, Razorpay, Google).

---

## 4. Contract Synchronization

All request body parameters and error responses are bound to Zod schemas in `@agentflow/contracts`. When new route schemas are authored, the Fastify OpenAPI plugin automatically includes their definitions, validation constraints, and example payloads in `/docs/json`.
