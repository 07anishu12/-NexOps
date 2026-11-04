import { WorkspaceRole } from '@agentflow/contracts';

export type Permission =
  // Workspace permissions
  | 'workspace:read'
  | 'workspace:update'
  | 'workspace:delete'
  | 'workspace:transfer_ownership'
  // Membership permissions
  | 'member:read'
  | 'member:invite'
  | 'member:update_role'
  | 'member:remove'
  | 'member:manage' // Legacy composite alias
  // Agent permissions
  | 'agent:read'
  | 'agent:create'
  | 'agent:update'
  | 'agent:publish'
  | 'agent:archive'
  | 'agent:delete'
  // Workflow permissions
  | 'workflow:read'
  | 'workflow:create'
  | 'workflow:update'
  | 'workflow:publish'
  // Deployment permissions
  | 'deployment:read'
  | 'deployment:create'
  | 'deployment:update'
  | 'deployment:publish'
  | 'deployment:rollback'
  // Operations permissions
  | 'run:read'
  | 'run:create'
  | 'run:retry'
  | 'run:cancel'
  | 'approval:read'
  | 'approval:resolve'
  // Integration permissions
  | 'integration:read'
  | 'integration:manage'
  | 'integration:revoke'
  // Financial permissions
  | 'billing:read'
  | 'billing:manage'
  | 'usage:read'
  // Developer permissions
  | 'api_key:read'
  | 'api_key:create'
  | 'api_key:revoke'
  | 'api_key:manage' // Legacy composite alias
  | 'webhook:manage'
  // Administrative permissions
  | 'audit:read'
  | 'security:manage'
  | 'settings:manage';

export const ROLE_PERMISSIONS: Record<WorkspaceRole, Permission[]> = {
  owner: [
    'workspace:read',
    'workspace:update',
    'workspace:delete',
    'workspace:transfer_ownership',
    'member:read',
    'member:invite',
    'member:update_role',
    'member:remove',
    'member:manage',
    'agent:read',
    'agent:create',
    'agent:update',
    'agent:publish',
    'agent:archive',
    'agent:delete',
    'workflow:read',
    'workflow:create',
    'workflow:update',
    'workflow:publish',
    'deployment:read',
    'deployment:create',
    'deployment:update',
    'deployment:publish',
    'deployment:rollback',
    'run:read',
    'run:create',
    'run:retry',
    'run:cancel',
    'approval:read',
    'approval:resolve',
    'integration:read',
    'integration:manage',
    'integration:revoke',
    'billing:read',
    'billing:manage',
    'usage:read',
    'api_key:read',
    'api_key:create',
    'api_key:revoke',
    'api_key:manage',
    'webhook:manage',
    'audit:read',
    'security:manage',
    'settings:manage'
  ],
  admin: [
    'workspace:read',
    'workspace:update',
    'member:read',
    'member:invite',
    'member:update_role',
    'member:remove',
    'member:manage',
    'agent:read',
    'agent:create',
    'agent:update',
    'agent:publish',
    'agent:archive',
    'agent:delete',
    'workflow:read',
    'workflow:create',
    'workflow:update',
    'workflow:publish',
    'deployment:read',
    'deployment:create',
    'deployment:update',
    'deployment:publish',
    'deployment:rollback',
    'run:read',
    'run:create',
    'run:retry',
    'run:cancel',
    'approval:read',
    'approval:resolve',
    'integration:read',
    'integration:manage',
    'integration:revoke',
    'billing:read',
    'billing:manage',
    'usage:read',
    'api_key:read',
    'api_key:create',
    'api_key:revoke',
    'api_key:manage',
    'webhook:manage',
    'audit:read',
    'security:manage',
    'settings:manage'
  ],
  developer: [
    'workspace:read',
    'member:read',
    'agent:read',
    'agent:create',
    'agent:update',
    'agent:publish',
    'agent:archive',
    'agent:delete',
    'workflow:read',
    'workflow:create',
    'workflow:update',
    'workflow:publish',
    'deployment:read',
    'deployment:create',
    'deployment:update',
    'deployment:publish',
    'deployment:rollback',
    'run:read',
    'run:create',
    'run:retry',
    'run:cancel',
    'approval:read',
    'integration:read',
    'billing:read',
    'usage:read',
    'api_key:read',
    'api_key:create',
    'api_key:revoke',
    'api_key:manage',
    'webhook:manage',
    'audit:read'
  ],
  operator: [
    'workspace:read',
    'member:read',
    'agent:read',
    'workflow:read',
    'deployment:read',
    'run:read',
    'run:retry',
    'run:cancel',
    'approval:read',
    'approval:resolve',
    'integration:read',
    'usage:read',
    'audit:read'
  ],
  viewer: [
    'workspace:read',
    'member:read',
    'agent:read',
    'workflow:read',
    'deployment:read',
    'run:read',
    'approval:read',
    'integration:read',
    'usage:read'
  ],
  member: [
    // Historical role: preserved safely without unintended elevation
    'workspace:read',
    'member:read',
    'agent:read',
    'agent:create',
    'agent:update',
    'agent:publish',
    'workflow:read',
    'deployment:read',
    'run:create',
    'run:read',
    'approval:resolve',
    'usage:read'
  ]
};

export function hasPermission(role: WorkspaceRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function assertPermission(role: WorkspaceRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Forbidden: Role '${role}' lacks permission '${permission}'`);
  }
}

export function requireWorkspacePermission(permission: Permission): (role: WorkspaceRole) => void {
  return (role: WorkspaceRole) => {
    assertPermission(role, permission);
  };
}
