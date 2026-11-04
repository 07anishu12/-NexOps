## Latest Implementation Changes

### Change 08
- Stage: 05 database access layer & RLS hardening
- Summary: Implemented discriminated TrustedTenantContext, 4 verified auth resolvers, 15 typed tenant-scoped repositories, timing-safe API key matching, and 24-point security test suite under restricted agentflow_app role.
- Files: `packages/database/src/*`, `packages/auth/src/api-keys.ts`, `docs/security/TENANT_ACCESS_MODEL.md`, `tests/*`
- Validation: 51/51 database tests passed (5 unit, 22 integration, 24 access security), architecture checks passed, monorepo typecheck/lint/tests passed.
- Blockers: None.
- Next step: Stage 06 Fastify API architecture and operational middleware.

### Change 09
- Stage: 06 Fastify API foundation & operational middleware
- Summary: Migrated `apps/api` to Fastify v5 with pure `buildApp()` factory, Stage 05 tenant resolvers hook, distributed Redis rate limiting, Helmet, CORS allowlists, W3C traceparent propagation, OpenAPI 3.0 at `/docs`, liveness `/health`, and readiness `/ready`.
- Files: `apps/api/src/*`, `apps/api/tests/*`, `docs/api/*`, `docs/DECISIONS.md`, `docs/BUILD_LEDGER.md`
- Validation: 24/24 API tests passed via `inject()`, 6/6 architecture tests passed, full monorepo typecheck, lint, tests (27/27 tasks), and all 5 app builds passed.
- Blockers: None.
- Next step: Stage 07 — Production authentication, Google OAuth and session management.

### Change 10
- Stage: 07 production authentication & Google OAuth
- Summary: Implemented Google OIDC Authorization Code flow with PKCE, HMAC-signed state, cryptographic ID token verification, anti-account-takeover rules, SHA-256 hashed sessions, session rotation, logout-all, `__Host-` cookies, CSRF protection, and Next.js `/app` route guards.
- Files: `packages/auth/src/*`, `packages/database/src/repositories/*`, `apps/api/src/routes/v1/auth.ts`, `apps/api/src/services/google-oauth.ts`, `apps/web/app/*`, `docs/security/*`
- Validation: 10 auth unit tests, 33 API tests, 51 database tests, 3 web tests, 6 architecture tests, monorepo typecheck/lint, and all 5 app builds passed.
- Blockers: None.
- Next step: Stage 08 — Workspace onboarding, membership & RBAC.

### Change 11
- Stage: 08 workspace onboarding, membership & RBAC
- Summary: Implemented multi-tenant workspace management, slug normalization with collision loops, 5-role RBAC with 35 permissions, last-owner demotion/removal protection, single-use 256-bit hashed invitations with anti-hijacking email matching, server-side session switching, and Next.js 15 control plane workspace switcher, onboarding wizard, and settings.
- Files: `packages/database/src/repositories/*`, `packages/auth/src/rbac.ts`, `packages/domain/src/workspace.ts`, `apps/api/src/routes/v1/workspaces.ts`, `apps/web/*`, `docs/*`
- Validation: 55/55 database tests, 45/45 API tests, 11/11 auth tests, 7/7 domain tests, 9/9 web tests, 6/6 architecture tests, monorepo typecheck/lint, Next.js build (13 routes).
- Blockers: None.
- Next step: Stage 09 — Agent builder and version snapshot engine.
