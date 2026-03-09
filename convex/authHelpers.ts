// Standard authentication helper functions for role-based access control
// Supports both single role (legacy) and roles array (recommended)

/**
 * Get all user roles from identity
 * 
 * The identity object from Convex/Clerk has roles in publicMetadata:
 * - identity.publicMetadata.roles (array of strings)
 * - identity.publicMetadata.role (legacy single role string)
 * 
 * We also check alternative locations for maximum compatibility.
 */
export function getUserRoles(identity: any): string[] {
  if (!identity) return [];
  
  const roles = new Set<string>();
  
  // Primary: Direct publicMetadata (Clerk JWT template standard)
  if (identity.publicMetadata) {
    if (Array.isArray(identity.publicMetadata.roles)) {
      identity.publicMetadata.roles.forEach((r: any) => {
        if (typeof r === 'string') roles.add(r);
      });
    }
    if (typeof identity.publicMetadata.role === 'string') {
      roles.add(identity.publicMetadata.role);
    }
  }
  
  // Fallback: Snake_case version
  if (identity.public_metadata) {
    if (Array.isArray(identity.public_metadata.roles)) {
      identity.public_metadata.roles.forEach((r: any) => {
        if (typeof r === 'string') roles.add(r);
      });
    }
    if (typeof identity.public_metadata.role === 'string') {
      roles.add(identity.public_metadata.role);
    }
  }
  
  // Fallback: Direct role field on identity
  if (typeof identity.role === 'string') {
    roles.add(identity.role);
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
  return roles[0];
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

/**
 * Check if user can mark attendance
 * Includes protocol team + cluster heads (for their own cluster members)
 */
export function canMarkAttendance(identity: any): boolean {
  const roles = getUserRoles(identity);
  return roles.includes("admin") || 
         roles.includes("protocol") || 
         roles.includes("follow-up-admin") ||
         roles.includes("cluster-head") ||
         roles.includes("cluster-admin") ||
         roles.includes("fellowship-pastor");
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
