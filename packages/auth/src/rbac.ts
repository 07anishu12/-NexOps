import { WorkspaceRole } from '@agentflow/contracts';

export type Permission =
  | 'workspace:read'
  | 'workspace:update'
  | 'workspace:delete'
  | 'member:manage'
  | 'agent:read'
  | 'agent:create'
  | 'agent:update'
  | 'agent:publish'
  | 'agent:delete'
  | 'run:create'
  | 'run:read'
  | 'approval:resolve'
  | 'integration:manage'
  | 'billing:manage'
  | 'api_key:manage';

const ROLE_PERMISSIONS: Record<WorkspaceRole, Permission[]> = {
  owner: [
    'workspace:read',
    'workspace:update',
    'workspace:delete',
    'member:manage',
    'agent:read',
    'agent:create',
    'agent:update',
    'agent:publish',
    'agent:delete',
    'run:create',
    'run:read',
    'approval:resolve',
    'integration:manage',
    'billing:manage',
    'api_key:manage'
  ],
  admin: [
    'workspace:read',
    'workspace:update',
    'member:manage',
    'agent:read',
    'agent:create',
    'agent:update',
    'agent:publish',
    'agent:delete',
    'run:create',
    'run:read',
    'approval:resolve',
    'integration:manage',
    'billing:manage',
    'api_key:manage'
  ],
  member: [
    'workspace:read',
    'agent:read',
    'agent:create',
    'agent:update',
    'agent:publish',
    'run:create',
    'run:read',
    'approval:resolve'
  ],
  viewer: [
    'workspace:read',
    'agent:read',
    'run:read'
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
