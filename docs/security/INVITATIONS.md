# Workspace Invitations & Cryptographic Tokens

**Document Version**: 1.0  
**Status**: Binding Security Architecture  
**Component**: `@agentflow/auth`, `@agentflow/database`, `@agentflow/api`, `@agentflow/web`  

---

## 1. Threat Model & Security Objectives

Workspace invitations represent a potential vector for unauthorized tenant access, token harvesting, link interception, and privilege escalation.

AgentFlow OS mitigates these risks through four core security invariants:
1. **High Entropy**: Tokens possess 256 bits of cryptographic entropy.
2. **Blind Storage**: Raw invitation tokens are never stored in the database. Only their SHA-256 hashes (`token_hash`) are persisted.
3. **Strict Single-Use Atomicity**: Once accepted, a token cannot be reused under any circumstances.
4. **Anti-Hijacking Email Binding**: A token can only be accepted by a user whose verified email address matches the exact email address specified when the invitation was issued.

---

## 2. Token Lifecycle & Flow

```
[ Owner/Admin ] Invites member by email
       │
       ▼
[ Token Generation ]
  - rawToken = randomBytes(32).toString('base64url') (256 bits)
  - tokenHash = sha256(rawToken)
       │
       ▼
[ Database Storage ]
  - INSERT INTO workspace_invitations (workspace_id, email, role, token_hash, token_expires_at)
       │
       ▼
[ Delivery ]
  - EmailDeliveryService.sendWorkspaceInvitation({ to, invitationUrl })
  - (Dev / Testing: MockEmailService logs link to console and returns in response)
       │
       ▼
[ Recipient Clicks Link ] ──► /invite?token=<rawToken>
       │
       ├──► Not Authenticated? ──► Redirect to Google OIDC with returnTo
       │
       ▼
[ Authenticated Recipient ] ──► POST /v1/workspaces/invitations/accept { token }
       │
       ▼
[ Atomic Acceptance Transaction ]
  1. Compute sha256(rawToken)
  2. Query workspace_invitations WHERE token_hash = $1 FOR UPDATE
  3. Verify NOT NULL, accepted_at IS NULL
  4. Verify token_expires_at > NOW()
  5. Anti-Hijacking Check: lower(auth_user.email) === lower(invitation.email)
  6. INSERT INTO workspace_members (workspace_id, user_id, role)
  7. UPDATE workspace_invitations SET accepted_at = NOW(), accepted_by = auth_user.id
  8. INSERT INTO audit_events ('member.joined_via_invitation')
       │
       ▼
[ Success ] Membership active; session active workspace updated.
```

---

## 3. Cryptographic Token Specification

- **Entropy Source**: Node.js `node:crypto.randomBytes(32)`.
- **Encoding**: URL-safe base64 (`base64url`), eliminating special characters like `+`, `/`, and `=`.
- **Hashing Function**: SHA-256 (`crypto.createHash('sha256').update(token).digest('hex')`).
- **Timing-Safe Verification**: Comparisons are performed either via index lookup on `token_hash` or with `crypto.timingSafeEqual` where applicable.

---

## 4. Anti-Hijacking Email Matching

If an invitation email is intercepted or forwarded to an unauthorized third party:
- When the third party attempts to accept the token, the backend compares the authenticated user's email against `invitation.email`.
- Because Google OAuth guarantees the email address of the authenticated session, spoofing is prevented.
- If the emails do not match, the request fails with:
  ```json
  {
    "success": false,
    "error": {
      "code": "FORBIDDEN",
      "message": "This invitation was sent to user@example.com. You are authenticated as attacker@example.com."
    }
  }
  ```

---

## 5. Email Delivery Service Abstraction

To decouple application logic from external SMTP or transactional email providers:

- **Interface (`EmailDeliveryService`)**:
  ```typescript
  export interface EmailDeliveryService {
    sendWorkspaceInvitation(params: {
      to: string;
      workspaceName: string;
      inviterName: string;
      role: string;
      invitationUrl: string;
      expiresAt: Date;
    }): Promise<{ delivered: boolean; messageId?: string }>;
  }
  ```
- **Implementation (`MockEmailService`)**:
  - Implements the interface during local development and testing.
  - Logs structured JSON with full invitation metadata to the logger.
  - Returns `invitationUrl` in the API payload in non-production environments to allow automated end-to-end acceptance testing.
- **Production Integration**: Ready for drop-in provider adapters (AWS SES, Resend, SendGrid) without changing workspace or invitation repositories.
