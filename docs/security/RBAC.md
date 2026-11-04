# Role-Based Access Control (RBAC) Specification

**Document Version**: 1.0  
**Status**: Binding Security Architecture  
**Component**: `@agentflow/auth`, `@agentflow/contracts`, `@agentflow/database`, `@agentflow/api`  

---

## 1. Overview & Principles

AgentFlow OS implements a least-privilege, deterministic Role-Based Access Control (RBAC) system for multi-tenant workspace isolation.

Access control is governed by four core principles:
1. **Explicit Role Hierarchy**: Five distinct roles (`owner`, `admin`, `developer`, `operator`, `viewer`) govern operations. A legacy `member` role is mapped to `developer` for backwards compatibility.
2. **Granular Permissions**: Authorization is not checked against raw role names in business logic; rather, operations require specific, fine-grained string permissions (e.g., `member:invite`, `execution:trigger`).
3. **Anti-Privilege Escalation**: Users cannot grant roles superior to their own, nor can a non-owner alter their own role to elevate privileges.
4. **Last-Owner Protection**: A workspace must retain at least one active owner at all times. Neither demoting nor removing the final owner is permitted.

---

## 2. Workspace Roles

| Role | Intended Persona | Scope of Authority |
|---|---|---|
| **`owner`** | Workspace Creator / Executive | Full administrative and destructive authority, including ownership transfer, billing, member removal, and workspace deletion. |
| **`admin`** | Team Lead / Security Manager | Full operational authority, member invitation and role management (up to Admin), integration management, and audit export. Cannot transfer ownership or delete workspace. |
| **`developer`** | AI Engineer / Integration Author | Creates and mutates agents, workflows, prompts, and tool configurations. Can trigger and test runs. Cannot manage team members, credentials, or billing. |
| **`operator`** | NOC / Support Agent / Triage | Triggers executions, views real-time traces, approves pending execution pauses, and inspects agent logs. Cannot alter agent code, workflows, or policies. |
| **`viewer`** | Auditor / Read-Only Stakeholder | Read-only inspection of workspaces, agents, workflows, and logs. No mutation or execution capabilities. |
| *`member` (legacy)* | General Member | Backwards-compatible fallback; granted identical entitlements as `developer`. |

---

## 3. Comprehensive Permission Matrix (35 Permissions across 10 Domains)

| Domain | Permission | Description | Owner | Admin | Developer | Operator | Viewer |
|---|---|---|:---:|:---:|:---:|:---:|:---:|
| **Workspace** | `workspace:read` | View workspace metadata and profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| | `workspace:update` | Update workspace name, timezone, locale | ✅ | ✅ | ❌ | ❌ | ❌ |
| | `workspace:archive` | Archive or reactivate workspace | ✅ | ✅ | ❌ | ❌ | ❌ |
| | `workspace:transfer_ownership` | Transfer primary ownership to another member | ✅ | ❌ | ❌ | ❌ | ❌ |
| | `workspace:delete` | Permanently destroy workspace and resources | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Members** | `member:read` | List workspace members and their roles | ✅ | ✅ | ✅ | ✅ | ✅ |
| | `member:invite` | Invite new users via single-use token | ✅ | ✅ | ❌ | ❌ | ❌ |
| | `member:update_role` | Change assigned role of an existing member | ✅ | ✅ | ❌ | ❌ | ❌ |
| | `member:remove` | Remove a member from the workspace | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Agents** | `agent:read` | View agent definitions, versions, and configs | ✅ | ✅ | ✅ | ✅ | ✅ |
| | `agent:create` | Create new agent instances | ✅ | ✅ | ✅ | ❌ | ❌ |
| | `agent:update` | Edit prompts, parameters, and tools | ✅ | ✅ | ✅ | ❌ | ❌ |
| | `agent:delete` | Delete or archive agent instances | ✅ | ✅ | ✅ | ❌ | ❌ |
| | `agent:deploy` | Promote agent to active production release | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Workflows** | `workflow:read` | Inspect LangGraph graph topology and states | ✅ | ✅ | ✅ | ✅ | ✅ |
| | `workflow:write` | Author or edit graph topologies and nodes | ✅ | ✅ | ✅ | ❌ | ❌ |
| | `workflow:execute` | Manually dispatch a workflow execution | ✅ | ✅ | ✅ | ✅ | ❌ |
| | `workflow:publish` | Publish workflow as public or embedded endpoint | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Integrations** | `integration:read` | View connected integration metadata | ✅ | ✅ | ✅ | ✅ | ✅ |
| | `integration:configure` | Connect new integrations (Slack, Git, Jira) | ✅ | ✅ | ❌ | ❌ | ❌ |
| | `integration:revoke` | Disconnect and revoke integration access | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Credentials** | `credential:read_metadata` | View secret names and rotation dates | ✅ | ✅ | ✅ | ❌ | ❌ |
| | `credential:write` | Store new encrypted provider keys / tokens | ✅ | ✅ | ❌ | ❌ | ❌ |
| | `credential:rotate` | Trigger key rotation for secrets | ✅ | ✅ | ❌ | ❌ | ❌ |
| | `credential:delete` | Revoke and purge stored encrypted secret | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Executions** | `execution:read` | View run traces, tokens, and outputs | ✅ | ✅ | ✅ | ✅ | ✅ |
| | `execution:trigger` | Dispatch agent or workflow runs | ✅ | ✅ | ✅ | ✅ | ❌ |
| | `execution:cancel` | Abort inflight agent executions | ✅ | ✅ | ✅ | ✅ | ❌ |
| | `execution:approve` | Sign or reject human-in-the-loop approval gates | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Audit Logs** | `audit:read` | View immutable audit event log | ✅ | ✅ | ❌ | ❌ | ✅ |
| | `audit:export` | Export compliance and security trail to CSV/JSON | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Billing** | `billing:read` | View usage meters, credits, and invoices | ✅ | ✅ | ❌ | ❌ | ❌ |
| | `billing:manage` | Upgrade subscription tier and payment method | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Invitations** | `invitation:read` | View pending invitation list | ✅ | ✅ | ❌ | ❌ | ❌ |
| | `invitation:create` | Generate single-use invitation link | ✅ | ✅ | ❌ | ❌ | ❌ |
| | `invitation:revoke` | Revoke a pending unaccepted invitation | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 4. Anti-Privilege Escalation & Safety Guardrails

The RBAC enforcement engine strictly validates safety constraints:

1. **Owner-Only Promotions**: Only existing workspace owners can promote any member to `owner` or execute `transferOwnership`.
2. **Self-Escalation Prohibition**: A member cannot alter their own role to elevate their permissions (e.g., an Admin cannot promote themselves to Owner).
3. **Last-Owner Invariant**:
   - Before executing any demotion (`updateMemberRole`) or member removal (`removeMember`), the system computes `SELECT COUNT(*) FROM workspace_members WHERE workspace_id = $1 AND role = 'owner'`.
   - If the count is 1 and the target is an owner, the operation is blocked with `409 Conflict: Cannot remove the final workspace owner`.
4. **Append-Only Audit Trail**: Every role alteration, invitation creation, revocation, and member removal generates a permanent row in `audit_events`.
