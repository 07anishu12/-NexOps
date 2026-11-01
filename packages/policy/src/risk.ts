import { ToolRisk } from '@agentflow/contracts';

export function requiresHumanApproval(
  risk: ToolRisk,
  environment: 'development' | 'staging' | 'production' = 'production',
  allowAutoApproveDev: boolean = false
): boolean {
  if (risk === 'read') return false;
  if (risk === 'high_impact') return true;
  if (risk === 'external_side_effect') {
    if (environment === 'development' && allowAutoApproveDev) {
      return false;
    }
    return true;
  }
  return false;
}
