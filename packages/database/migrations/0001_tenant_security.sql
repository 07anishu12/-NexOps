DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agentflow_app') THEN
    CREATE ROLE agentflow_app NOLOGIN;
  END IF;
  EXECUTE format('GRANT agentflow_app TO %I', CURRENT_USER);
END
$$;--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO agentflow_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO agentflow_app;--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO agentflow_app;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO agentflow_app;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO agentflow_app;--> statement-breakpoint

CREATE OR REPLACE FUNCTION agentflow_current_workspace_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_workspace_id', true), '')::uuid
$$;--> statement-breakpoint

DO $$
DECLARE
  table_name text;
  workspace_tables text[] := ARRAY[
    'workspaces', 'workspace_members', 'workspace_invitations',
    'agents', 'agent_versions', 'agent_evaluation_suites', 'agent_evaluation_cases', 'agent_evaluation_results',
    'agent_version_tools', 'encrypted_credentials', 'integration_connections',
    'deployments', 'deployment_origins', 'deployment_releases', 'api_keys', 'widget_sessions',
    'conversations', 'messages', 'runs', 'run_steps', 'run_events', 'tool_operations',
    'approvals', 'approval_events', 'workflows', 'workflow_versions', 'workflow_triggers', 'workflow_runs',
    'knowledge_sources', 'knowledge_chunks', 'credit_accounts', 'credit_ledger_entries', 'credit_reservations', 'usage_events',
    'payment_orders', 'payment_events', 'webhook_endpoints', 'webhook_deliveries',
    'audit_events', 'notifications', 'fde_implementation_records', 'deployment_readiness_reports',
    'deployment_readiness_checks', 'support_access_grants'
  ];
BEGIN
  FOREACH table_name IN ARRAY workspace_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS agentflow_workspace_isolation ON public.%I', table_name);
    IF table_name = 'workspaces' THEN
      EXECUTE format('CREATE POLICY agentflow_workspace_isolation ON public.%I USING (id = agentflow_current_workspace_id()) WITH CHECK (id = agentflow_current_workspace_id())', table_name);
    ELSE
      EXECUTE format('CREATE POLICY agentflow_workspace_isolation ON public.%I USING (workspace_id = agentflow_current_workspace_id()) WITH CHECK (workspace_id = agentflow_current_workspace_id())', table_name);
    END IF;
  END LOOP;
END
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION prevent_agentflow_append_only_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Append-only evidence table %.% cannot be updated or deleted', TG_TABLE_SCHEMA, TG_TABLE_NAME USING ERRCODE = '55000';
END
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS agent_versions_append_only ON agent_versions;--> statement-breakpoint
CREATE TRIGGER agent_versions_append_only BEFORE UPDATE OR DELETE ON agent_versions FOR EACH ROW EXECUTE FUNCTION prevent_agentflow_append_only_mutation();--> statement-breakpoint
DROP TRIGGER IF EXISTS workflow_versions_append_only ON workflow_versions;--> statement-breakpoint
CREATE TRIGGER workflow_versions_append_only BEFORE UPDATE OR DELETE ON workflow_versions FOR EACH ROW EXECUTE FUNCTION prevent_agentflow_append_only_mutation();--> statement-breakpoint
DROP TRIGGER IF EXISTS approval_events_append_only ON approval_events;--> statement-breakpoint
CREATE TRIGGER approval_events_append_only BEFORE UPDATE OR DELETE ON approval_events FOR EACH ROW EXECUTE FUNCTION prevent_agentflow_append_only_mutation();--> statement-breakpoint
DROP TRIGGER IF EXISTS credit_ledger_entries_append_only ON credit_ledger_entries;--> statement-breakpoint
CREATE TRIGGER credit_ledger_entries_append_only BEFORE UPDATE OR DELETE ON credit_ledger_entries FOR EACH ROW EXECUTE FUNCTION prevent_agentflow_append_only_mutation();--> statement-breakpoint
DROP TRIGGER IF EXISTS payment_events_append_only ON payment_events;--> statement-breakpoint
CREATE TRIGGER payment_events_append_only BEFORE UPDATE OR DELETE ON payment_events FOR EACH ROW EXECUTE FUNCTION prevent_agentflow_append_only_mutation();--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_events_append_only ON audit_events;--> statement-breakpoint
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION prevent_agentflow_append_only_mutation();--> statement-breakpoint
DROP TRIGGER IF EXISTS run_events_append_only ON run_events;--> statement-breakpoint
CREATE TRIGGER run_events_append_only BEFORE UPDATE OR DELETE ON run_events FOR EACH ROW EXECUTE FUNCTION prevent_agentflow_append_only_mutation();
