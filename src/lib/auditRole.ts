export function getAuditActorRole(role: string | null | undefined): string {
  if (!role) {
    return 'admin';
  }

  if (role === 'admin' || role === 'regional_admin' || role === 'tsm' || role === 'super_admin' || role === 'team_leader' || role === 'captain') {
    return role;
  }

  return 'admin';
}