export type WorkspaceRole = 'owner' | 'dispatcher' | 'technician';

export type WorkspaceCapability =
  | 'operations.read'
  | 'operations.manage'
  | 'team.read'
  | 'team.manage';

const CAPABILITIES: Record<WorkspaceCapability, readonly WorkspaceRole[]> = {
  'operations.read': ['owner', 'dispatcher', 'technician'],
  'operations.manage': ['owner', 'dispatcher'],
  'team.read': ['owner', 'dispatcher'],
  'team.manage': ['owner'],
};

export function can(role: WorkspaceRole, capability: WorkspaceCapability) {
  return CAPABILITIES[capability].includes(role);
}

export function rolesFor(capability: WorkspaceCapability): WorkspaceRole[] {
  return [...CAPABILITIES[capability]];
}
