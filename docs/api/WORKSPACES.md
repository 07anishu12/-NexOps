# Workspaces, Members & Invitations API Reference

**Document Version**: 1.0  
**Base Path**: `/v1/workspaces`  
**Authentication**: Session Cookie (`af_session` / `__Host-af_session`) or Bearer API Key  

---

## Endpoint Summary

| Method | Path | Required Permission | Description |
|---|---|---|---|
| `POST` | `/v1/workspaces` | Authenticated User | Create a new workspace and become its owner |
| `GET` | `/v1/workspaces` | Authenticated User | List all workspaces accessible to current user |
| `GET` | `/v1/workspaces/current` | `workspace:read` | Retrieve active workspace context & role |
| `GET` | `/v1/workspaces/:workspaceId` | `workspace:read` | Retrieve workspace details |
| `PATCH` | `/v1/workspaces/:workspaceId` | `workspace:update` | Update workspace settings (name, timezone, status) |
| `POST` | `/v1/workspaces/:workspaceId/select` | Authenticated User | Switch active workspace in session |
| `POST` | `/v1/workspaces/:workspaceId/onboarding` | `workspace:update` | Complete onboarding configuration |
| `POST` | `/v1/workspaces/:workspaceId/transfer-ownership` | `workspace:transfer_ownership` | Transfer primary owner to another member |
| `GET` | `/v1/workspaces/:workspaceId/members` | `member:read` | List active workspace members |
| `PATCH` | `/v1/workspaces/:workspaceId/members/:memberId` | `member:update_role` | Update member role |
| `DELETE` | `/v1/workspaces/:workspaceId/members/:memberId` | `member:remove` | Remove a member |
| `POST` | `/v1/workspaces/:workspaceId/invitations` | `member:invite` | Send single-use invitation email |
| `GET` | `/v1/workspaces/:workspaceId/invitations` | `invitation:read` | List pending unaccepted invitations |
| `DELETE` | `/v1/workspaces/:workspaceId/invitations/:invitationId` | `invitation:revoke` | Revoke a pending invitation |
| `POST` | `/v1/workspaces/invitations/accept` | Authenticated User | Accept invitation using single-use token |

---

## Detailed Specifications

### 1. `POST /v1/workspaces`
Creates a new workspace, assigns the creator as `owner`, and selects it as active.

- **Request Body**:
  ```json
  {
    "name": "Acme Ops Global",
    "slug": "acme-ops-global",
    "timezone": "America/New_York",
    "locale": "en-US"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "data": {
      "workspace": {
        "id": "6538008e-ad69-4708-a884-91efacd5a408",
        "name": "Acme Ops Global",
        "slug": "acme-ops-global",
        "status": "active",
        "timezone": "America/New_York",
        "locale": "en-US",
        "onboardingCompleted": false
      },
      "membership": {
        "id": "bb3b4ec5-5606-4dc1-9d20-9951450e96b8",
        "userId": "b5adab00-a496-4b5c-9ec9-11727bee1206",
        "role": "owner"
      }
    }
  }
  ```

---

### 2. `POST /v1/workspaces/:workspaceId/select`
Switches the active workspace persisted in the server-side session.

- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "activeWorkspaceId": "6538008e-ad69-4708-a884-91efacd5a408",
      "role": "owner",
      "workspaceName": "Acme Ops Global",
      "slug": "acme-ops-global"
    }
  }
  ```

---

### 3. `POST /v1/workspaces/:workspaceId/onboarding`
Records initial workspace intent and marks onboarding complete.

- **Request Body**:
  ```json
  {
    "useCase": "customer_support",
    "targetChannels": ["slack", "widget"],
    "skippedIntegrations": true
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "id": "6538008e-ad69-4708-a884-91efacd5a408",
      "onboardingCompleted": true,
      "onboardingIntent": {
        "useCase": "customer_support",
        "targetChannels": ["slack", "widget"],
        "skippedIntegrations": true
      }
    }
  }
  ```

---

### 4. `POST /v1/workspaces/:workspaceId/invitations`
Creates a 256-bit single-use invitation token, hashes it with SHA-256, and dispatches an email.

- **Request Body**:
  ```json
  {
    "email": "engineer@acme.com",
    "role": "developer"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "data": {
      "id": "5285743d-0453-488f-b9f1-a75d9e5db422",
      "email": "engineer@acme.com",
      "role": "developer",
      "tokenExpiresAt": "2026-11-11T17:36:38.739Z",
      "invitationUrl": "http://localhost:3000/invite?token=2GkL..."
    }
  }
  ```

---

### 5. `POST /v1/workspaces/invitations/accept`
Consumes an invitation token and adds the authenticated user to the workspace.

- **Request Body**:
  ```json
  {
    "token": "2GkL...rawBase64UrlToken..."
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "workspace": {
        "id": "6538008e-ad69-4708-a884-91efacd5a408",
        "name": "Acme Ops Global",
        "slug": "acme-ops-global"
      },
      "membership": {
        "id": "7094a0ec-93b9-4b06-ab63-5fced23833f4",
        "role": "developer"
      }
    }
  }
  ```
- **Errors**:
  - `400 Bad Request`: Token missing or format invalid.
  - `403 Forbidden`: Authenticated user email does not match invitation recipient email.
  - `409 Conflict`: Token already accepted, expired, or user is already a member.
