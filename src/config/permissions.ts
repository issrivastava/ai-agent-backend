export type Role = 'admin' | 'agent' | 'viewer';

export type Permission =
  | 'workflows:manage'
  | 'workflows:run'
  | 'runs:decide'
  | 'tickets:reassign'
  | 'extractions:upload'
  | 'users:manage';

const matrix: Record<Role, readonly Permission[]> = {
  admin: [
    'workflows:manage',
    'workflows:run',
    'runs:decide',
    'tickets:reassign',
    'extractions:upload',
    'users:manage',
  ],
  agent: ['workflows:run', 'runs:decide', 'tickets:reassign', 'extractions:upload'],
  viewer: [],
};

export function hasPermission(role: Role, permission: Permission) {
  return matrix[role].includes(permission);
}