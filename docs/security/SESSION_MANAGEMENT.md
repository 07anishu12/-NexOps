# AgentFlow OS — Session Management & CSRF Defense Specification

**Document Version**: 1.0  
**Baseline Date**: 2026-11-04  
**Status**: Authoritative Security Specification  
**Implementation Stage**: Stage 07 (Production Authentication, Google OAuth, and Session Management)  

---

## 1. Server-Side Session Model

AgentFlow OS utilizes high-entropy, cryptographically hashed, server-side persisted sessions. **Raw session tokens are never stored in the database.**

### 1.1 Database Schema (`sessions` table)
Each session is stored in PostgreSQL as defined in `packages/database/src/schema/identity.ts`:

| Column | Type | Constraints / Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | Primary Key, `defaultRandom()` | Unique session identifier for management and revocation. |
| `user_id` | `uuid` | Foreign Key -> `users.id` (CASCADE) | User who owns the session. |
| `token_hash` | `varchar(255)` | Unique, Not Null | **SHA-256 digest** of the raw bearer session token. |
| `ip_address` | `varchar(45)` | Nullable | Client IP address at session creation / last touch. |
| `user_agent` | `text` | Nullable | Client User-Agent string. |
| `expires_at` | `timestamp with time zone` | Not Null | Session expiration deadline (default 7 days). |
| `revoked_at` | `timestamp with time zone` | Nullable | Immediate invalidation timestamp. |
| `last_active_at` | `timestamp with time zone` | `now()`, Not Null | Throttled sliding activity timestamp. |
| `created_at` | `timestamp with time zone` | `now()`, Not Null | Creation timestamp. |

Indexes are maintained on `(user_id, expires_at)` and `token_hash` for fast validation and bulk revocation.

---

## 2. Cryptographic Token Lifecycle

### 2.1 Token Generation
```typescript
// packages/auth/src/session.ts
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}
```
- **Entropy**: 256 bits of cryptographically secure random bytes generated via Node.js `crypto.randomBytes()`.
- **Encoding**: URL-safe base64 (`base64url`), producing a 43-character string without padding (`=`).

### 2.2 Token Hashing & Verification
- **Storage**: Upon generation, the API calculates `token_hash = crypto.createHash('sha256').update(rawToken).digest('hex')` and writes only the hash to PostgreSQL.
- **Verification**: On incoming requests, the token from cookie or header is hashed via SHA-256 and matched against `sessions.token_hash`.
- **Timing Attacks**: Token comparisons use `crypto.timingSafeEqual` to eliminate timing side-channel leakage.

### 2.3 Session Rotation on Login
To eliminate session fixation vulnerabilities:
- Whenever a user logs in via OAuth, any existing session associated with the incoming cookie is atomically revoked in PostgreSQL (`SessionRepository.rotateSession`).
- A completely fresh 256-bit token is minted and issued in a fresh cookie.

### 2.4 Sliding Expiration ("Touch")
- Default TTL: 7 days (`SESSION_TTL_SECONDS=604800`).
- To prevent excessive database write amplification, `touchSession` updates `last_active_at` and extends `expires_at` only if more than 5 minutes have elapsed since the last touch.

### 2.5 Revocation & Invalidation
- **Single Session Revocation (`POST /v1/auth/logout`)**: Sets `revoked_at = now()` for the active session and clears the browser cookie.
- **Revoke Device by ID (`DELETE /v1/auth/sessions/:sessionId`)**: Allows a user to selectively disconnect a specific remote device.
- **Revoke All Devices (`POST /v1/auth/logout-all`)**: Atomically updates `revoked_at = now()` across all sessions for that `user_id` where `revoked_at IS NULL`. Immediate effect across all distributed API nodes.

---

## 3. Cookie Configuration & The `__Host-` Prefix

Session tokens are transmitted to web browsers exclusively via HTTP cookies configured according to strict defense-in-depth principles:

```typescript
// packages/auth/src/session.ts
export function getSessionCookieConfig(isProduction: boolean, domain?: string): CookieOptions {
  return {
    name: isProduction ? '__Host-af_session' : 'af_session',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    domain: isProduction ? undefined : domain, // __Host- prefix prohibits domain attribute
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}
```

### Defense Properties:
1. `__Host-` Prefix (RFC 6265bis):
   - Enforced automatically in production environments.
   - Forbids the cookie from being scoped to parent/subdomains (must be host-only).
   - Requires `Secure` flag (HTTPS only).
   - Requires `Path=/`.
   - Prevents cookie injection from untrusted subdomains.
2. `HttpOnly`:
   - Prohibits JavaScript access (`document.cookie`), preventing token extraction via Cross-Site Scripting (XSS).
3. `SameSite=Lax`:
   - Prevents CSRF on third-party cross-site POST/PUT/DELETE requests while allowing top-level GET navigation (e.g., following a link into the application).

---

## 4. Cross-Site Request Forgery (CSRF) Defense

AgentFlow OS employs a multi-layered defense against CSRF:

### 4.1 Origin & Referer Validation (`csrfPlugin`)
The Fastify API registers a dedicated CSRF verification pre-handler (`apps/api/src/plugins/csrf.ts`):
- Safe HTTP methods (`GET`, `HEAD`, `OPTIONS`) are permitted without Origin headers.
- For state-mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) carrying a session cookie:
  1. The pre-handler inspects the `Origin` or `Referer` header.
  2. If missing, or if the origin does not match the configured `AUTH_ALLOWED_REDIRECT_ORIGINS` (or request `Host`), the request is rejected with `403 FORBIDDEN` (`CSRF_ORIGIN_INVALID`).
- Non-cookie requests (e.g., automated API calls with Bearer API keys) are exempted because cross-site browser requests cannot attach custom headers without preflight CORS rejection.

### 4.2 Constant-Time CSRF Token Verification
For explicit CSRF token verification (forms or single-page apps without origin headers), `generateCsrfToken` and `verifyCsrfToken` are exported by `@agentflow/auth` using HMAC-SHA256 digests.

---

## 5. Web Control Plane Route Protection (`apps/web`)

The Next.js 15 web application enforces server-side route guards in App Router server components:

### 5.1 Route Structure
- `/login`: Public sign-in page featuring the Google OAuth trigger button and authentication error banners.
- `/app`: Server-rendered protected control plane dashboard.
- `/api/auth/logout`: Route handler clearing local cookies and calling API revocation.

### 5.2 Server Guard Implementation
```typescript
// apps/web/app/app/page.tsx
const session = await getAuthenticatedSession();
if (!session) {
  redirect('/login?error=session_expired');
}
```
The server-side helper (`apps/web/lib/session.ts`) forwards incoming browser cookies to the Fastify API (`GET /v1/auth/me`). If invalid or expired, Next.js immediately issues a 307/303 redirect to `/login` without streaming any private control plane UI to the client.
