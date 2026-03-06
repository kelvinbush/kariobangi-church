// Standard authentication helper functions for role-based access control
// Supports both single role (legacy) and roles array (recommended)

/**
 * Get all user roles from identity
 * Checks multiple sources for maximum compatibility:
 * - identity.roles (array - recommended)
 * - identity.role (string - legacy)
 * - identity.publicMetadata.roles
 * - identity.metadata.roles
 * - identity.claims.roles
 */
export function getUserRoles(identity: any): string[] {
  const roles = new Set<string>();
  
  const sources = [
    identity,
    identity?.publicMetadata,
    identity?.public_metadata,
    identity?.metadata,
    identity?.claims,
    identity?.customClaims,
  ];
  
  for (const source of sources) {
    if (!source) continue;
    
    // Roles array (preferred)
    if (source.roles && Array.isArray(source.roles)) {
      source.roles.forEach((r: string) => {
        if (typeof r === 'string') roles.add(r);
      });
    }
    
    // Single role (legacy support)
    if (source.role && typeof source.role === 'string') {
      roles.add(source.role);
    }
  }
  
  return Array.from(roles);
}

/**
 * Check if user has ANY of the required roles
 */
export function hasAnyRole(userRoles: string[], requiredRoles: string[]): boolean {
  return userRoles.some(role => requiredRoles.includes(role));
}

/**
 * Check if user has ALL of the required roles
 */
export function hasAllRoles(userRoles: string[], requiredRoles: string[]): boolean {
  return requiredRoles.every(role => userRoles.includes(role));
}

/**
 * Legacy helper - gets single role (for backward compatibility)
 * @deprecated Use getUserRoles instead
 */
export function getRoleFromIdentity(identity: any): string | undefined {
  const roles = getUserRoles(identity);
  return roles[0]; // Return first role for backward compatibility
}

// ======== Role Check Helpers ========

export function isAdmin(identity: any): boolean {
  return getUserRoles(identity).includes("admin");
}

export function isProtocolTeam(identity: any): boolean {
  const roles = getUserRoles(identity);
  return roles.includes("admin") || 
         roles.includes("protocol") || 
         roles.includes("follow-up-admin");
}

export function isFollowUpAdmin(identity: any): boolean {
  const roles = getUserRoles(identity);
  return roles.includes("admin") || roles.includes("follow-up-admin");
}

export function isClusterAdmin(identity: any): boolean {
  const roles = getUserRoles(identity);
  return roles.includes("admin") || 
         roles.includes("cluster-admin") || 
         roles.includes("fellowship-pastor");
}

export function isClusterHead(identity: any): boolean {
  const roles = getUserRoles(identity);
  return roles.includes("admin") || 
         roles.includes("cluster-head") || 
         roles.includes("fellowship-pastor");
}

export function isFellowshipPastor(identity: any): boolean {
  const roles = getUserRoles(identity);
  return roles.includes("admin") || roles.includes("fellowship-pastor");
}

// ======== Require Helpers (throw if not authorized) ========

export function requireAdmin(identity: any): void {
  if (!isAdmin(identity)) {
    throw new Error("Forbidden: requires admin");
  }
}

export function requireProtocolTeam(identity: any): void {
  if (!isProtocolTeam(identity)) {
    throw new Error("Forbidden: requires protocol, follow-up-admin, or admin role");
  }
}

export function requireFollowUpAdmin(identity: any): void {
  if (!isFollowUpAdmin(identity)) {
    throw new Error("Forbidden: requires follow-up-admin or admin role");
  }
}

export function requireClusterAdmin(identity: any): void {
  if (!isClusterAdmin(identity)) {
    throw new Error("Forbidden: requires cluster-admin, fellowship-pastor, or admin role");
  }
}

export function requireClusterHead(identity: any): void {
  if (!isClusterHead(identity)) {
    throw new Error("Forbidden: requires cluster-head, fellowship-pastor, or admin role");
  }
}
