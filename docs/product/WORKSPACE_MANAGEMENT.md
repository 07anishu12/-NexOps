# Workspace Management & Lifecycle Architecture

**Document Version**: 1.0  
**Status**: Production Standard  
**Component**: `@agentflow/domain`, `@agentflow/database`, `@agentflow/api`, `@agentflow/web`  

---

## 1. Executive Overview

In AgentFlow OS, a **Workspace** is the fundamental security boundary, isolation tier, and administrative unit for all agent deployments, workflows, API keys, credentials, and telemetry. Every tenant resource exists strictly within the context of a workspace.

This document details:
1. Workspace lifecycle states and state transitions.
2. Slug generation, normalization, reserved namespace guarantees, and collision resolution.
3. Multi-step onboarding workflows.
4. Active workspace selection and server-side session persistence.
5. Ownership transfer semantics.

---

## 2. Workspace Lifecycle & States

A workspace moves through the following explicit lifecycle states:

```
[ New Workspace Request ]
           │
           ▼
     [ Active ]  ◄──┐ (Unarchived)
           │        │
           ▼        │
    [ Archived ] ───┘
```

- **Active (`active`)**: The standard operational state. All agents can execute, scheduled workflows trigger, and members can access resources according to their RBAC role.
- **Archived (`archived`)**: Administrative freeze. No new runs, executions, or agent modifications can take place. Access is read-only for owners and admins; members with operational or developer roles are prevented from mutations. Audit logs and history remain immutable and permanently preserved.

---

## 3. Workspace Slug Architecture

Workspaces feature a URL-friendly identifier (`slug`) used for vanity routes, widget embedding origins, and human-readable links.

### Slug Format & Constraints
- **Character Set**: Lowercase ASCII letters (`a-z`), digits (`0-9`), and non-consecutive hyphens (`-`).
- **Length**: Minimum 3 characters, maximum 48 characters.
- **Regex Check**: `^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$` (enforced at runtime in `@agentflow/domain` and in PostgreSQL via CHECK constraint).
- **Reserved Slugs**: Protected routing keywords are rejected:
  - `api`, `auth`, `admin`, `settings`, `billing`, `login`, `logout`, `oauth`, `register`, `signup`, `onboarding`, `app`, `widget`, `docs`, `health`, `metrics`, `status`, `internal`, `system`, `support`, `root`, `webhook`, `static`, `assets`, `public`, `dashboard`, `team`, `members`.

### Slug Normalization & Collision Loop
1. The user provides a display name (e.g., `Acme Corp Global`).
2. An initial candidate slug is derived by lowercasing, replacing punctuation/spaces with `-`, and trimming (`acme-corp-global`).
3. If the candidate matches a reserved slug, a random 4-character suffix is appended (`admin-4f9a`).
4. **Collision Handling**: A database uniqueness check verifies availability before insertion. If a collision is encountered, the generator appends a cryptographic random suffix (`-4a2b`) and retries up to 5 times inside the transaction before failing gracefully.

---

## 4. Multi-Step Onboarding Architecture

Upon creating a workspace, the creator is guided through an onboarding flow designed to tailor the workspace environment:

1. **Step 1: Use Case Selection**:
   - `customer_support`: Configures default customer service guardrails, SLA thresholds, and triage intents.
   - `devops_cloud`: Prepares SRE runbook tools, shell sandboxing, and infrastructure monitors.
   - `sales_revenue`: Connects CRM schema presets and pipeline enrichment bots.
   - `custom_ops`: Standard open-ended LangGraph execution template.
2. **Step 2: Target Channels**:
   - Supported options: `slack`, `teams`, `email`, `widget`, `webhook`.
3. **Step 3: Tool Integrations & Skip Support**:
   - Offers rapid connection to databases, ticketing platforms, and Git providers.
   - Supports **"Skip integrations for now"** to enable immediate console onboarding without requiring external API keys.
4. **Completion**:
   - The onboarding parameters are recorded on the `workspaces` table (`onboarding_intent`, `onboarding_completed: true`).

---

## 5. Active Workspace Selection & Session Binding

AgentFlow OS utilizes persistent server-side sessions stored in PostgreSQL (`sessions` table).

- When a user logs in, their session defaults to their primary or first-joined workspace.
- When switching workspaces via the web interface or API (`POST /v1/workspaces/:workspaceId/select`), the server verifies active membership in the target workspace.
- The `active_workspace_id` column on the `sessions` table is atomically updated.
- All subsequent API requests authenticated by that session cookie automatically adopt the new workspace tenant context, setting the PostgreSQL RLS session variable `app.current_workspace_id` via `withWorkspaceAppTransaction`.
