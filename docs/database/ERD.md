# AgentFlow OS — Entity Relationship Diagram (ERD)

## Core Domain Relationships

```mermaid
erDiagram
    users ||--o{ oauth_accounts : "authenticates via"
    users ||--o{ sessions : "maintains"
    users ||--o{ workspace_members : "belongs to"
    users ||--o{ workspaces : "owns"

    workspaces ||--|{ workspace_members : "contains"
    workspaces ||--o{ workspace_invitations : "issues"
    workspaces ||--o{ agents : "owns"
    workspaces ||--o{ integration_connections : "authorizes"
    workspaces ||--o{ deployments : "manages"
    workspaces ||--o{ conversations : "hosts"
    workspaces ||--o{ runs : "executes"
    workspaces ||--o{ workflows : "orchestrates"
    workspaces ||--o{ credit_accounts : "holds"
    workspaces ||--o{ payment_orders : "bills"
    workspaces ||--o{ webhook_endpoints : "registers"
    workspaces ||--o{ audit_events : "audits"
    workspaces ||--o{ fde_implementation_records : "tracks"

    agents ||--|{ agent_versions : "versions"
    agents ||--o{ deployments : "deployed to"
    agents ||--o{ agent_evaluation_suites : "evaluated by"
    agents ||--o{ conversations : "converses in"

    agent_versions ||--o{ agent_version_tools : "enables"
    tool_definitions ||--o{ agent_version_tools : "referenced by"
    agent_versions ||--o{ deployment_releases : "released in"
    agent_versions ||--o{ runs : "instantiates"

    deployments ||--o{ deployment_origins : "restricts"
    deployments ||--o{ deployment_releases : "historical"
    deployments ||--o{ widget_sessions : "authenticates"
    deployments ||--o{ api_keys : "scopes"
    deployments ||--o{ runs : "executes"

    integration_connections ||--o{ encrypted_credentials : "stores"

    conversations ||--|{ messages : "contains"
    conversations ||--o{ runs : "triggers"

    runs ||--|{ run_steps : "executes"
    runs ||--|{ run_events : "streams"
    runs ||--o{ tool_operations : "performs"
    runs ||--o{ approvals : "requests"
    runs ||--o{ credit_reservations : "reserves"
    runs ||--o{ usage_events : "meters"

    tool_operations ||--o{ approvals : "gated by"
    approvals ||--o{ approval_events : "decided in"

    workflows ||--|{ workflow_versions : "versions"
    workflows ||--o{ workflow_triggers : "triggered by"
    workflow_versions ||--o{ workflow_runs : "runs"

    knowledge_sources ||--|{ knowledge_chunks : "chunks"

    credit_accounts ||--o{ credit_ledger_entries : "authoritative"
    credit_accounts ||--o{ credit_reservations : "holds"

    payment_orders ||--o{ payment_events : "reconciles"
    webhook_endpoints ||--o{ webhook_deliveries : "dispatches"

    fde_implementation_records ||--o{ deployment_readiness_reports : "validates"
    deployment_readiness_reports ||--|{ deployment_readiness_checks : "contains"
    workspaces ||--o{ support_access_grants : "grants"
```

---

## Detailed Relational Models

### 1. Identity & Tenancy
```mermaid
erDiagram
    users {
        uuid id PK
        varchar email UK
        varchar name
        timestamp created_at
    }
    workspaces {
        uuid id PK
        varchar slug UK
        varchar name
        uuid owner_id FK
        enum plan
    }
    workspace_members {
        uuid id PK
        uuid workspace_id FK
        uuid user_id FK
        enum role
    }
    sessions {
        uuid id PK
        varchar session_token_hash UK
        uuid user_id FK
        uuid workspace_id FK
        timestamp expires_at
    }

    users ||--o{ workspaces : "owns"
    workspaces ||--|{ workspace_members : "members"
    users ||--|{ workspace_members : "membership"
    users ||--o{ sessions : "sessions"
```

### 2. Runtime Execution & Approvals
```mermaid
erDiagram
    runs {
        uuid id PK
        uuid workspace_id FK
        uuid agent_version_id FK
        enum state
        varchar idempotency_key UK
        varchar correlation_id
        timestamp started_at
        timestamp completed_at
    }
    run_steps {
        uuid id PK
        uuid run_id FK
        integer sequence
        enum status
    }
    run_events {
        uuid id PK
        uuid run_id FK
        integer sequence
        varchar event_type
        jsonb data
    }
    tool_operations {
        uuid id PK
        uuid run_id FK
        varchar operation_key
        varchar payload_hash
        enum status
    }
    approvals {
        uuid id PK
        uuid run_id FK
        uuid tool_operation_id FK
        varchar payload_hash
        enum status
        timestamp expires_at
        timestamp consumed_at
    }

    runs ||--|{ run_steps : "steps"
    runs ||--|{ run_events : "events"
    runs ||--o{ tool_operations : "operations"
    tool_operations ||--o{ approvals : "approval"
```

### 3. Financial Ledger & Idempotency
```mermaid
erDiagram
    credit_accounts {
        uuid id PK
        uuid workspace_id UK
        varchar currency UK
        numeric cached_balance
    }
    credit_ledger_entries {
        uuid id PK
        uuid workspace_id FK
        uuid account_id FK
        enum type
        numeric amount
        numeric balance_after
        varchar idempotency_key UK
    }
    credit_reservations {
        uuid id PK
        uuid workspace_id FK
        uuid account_id FK
        uuid run_id FK
        numeric held_amount
        numeric settled_amount
        enum status
    }

    credit_accounts ||--|{ credit_ledger_entries : "immutable ledger"
    credit_accounts ||--o{ credit_reservations : "holds"
```

### 4. FDE & Customer Operations
```mermaid
erDiagram
    fde_implementation_records {
        uuid id PK
        uuid workspace_id FK
        varchar customer_name
        enum environment
        enum status
    }
    deployment_readiness_reports {
        uuid id PK
        uuid implementation_id FK
        uuid deployment_id FK
        enum status
        varchar checker_version
    }
    deployment_readiness_checks {
        uuid id PK
        uuid report_id FK
        varchar check_key
        enum status
        boolean blocking
    }
    support_access_grants {
        uuid id PK
        uuid workspace_id FK
        uuid requested_by FK
        uuid approved_by FK
        varchar reason_code
        timestamp expires_at
    }

    fde_implementation_records ||--o{ deployment_readiness_reports : "reports"
    deployment_readiness_reports ||--|{ deployment_readiness_checks : "checks"
```
