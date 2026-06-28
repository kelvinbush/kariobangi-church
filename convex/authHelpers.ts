// Authentication helper functions for role-based access control.
// Kariobangi uses two roles: `protocol` (register + mark attendance) and `admin` (full access).
// Supports both a single role (legacy) and a roles array.

/**
 * Get all user roles from identity.
 *
 * Clerk surfaces roles in publicMetadata:
 * - identity.publicMetadata.roles (array of strings)
 * - identity.publicMetadata.role (legacy single role string)
 * We also check alternative locations for maximum compatibility.
 */
export function getUserRoles(identity: any): string[] {
  if (!identity) return [];

  const roles = new Set<string>();

  // Primary: Direct publicMetadata (Clerk JWT template standard)
  if (identity.publicMetadata) {
    if (Array.isArray(identity.publicMetadata.roles)) {
      identity.publicMetadata.roles.forEach((r: any) => {
        if (typeof r === "string") roles.add(r);
      });
    }
    if (typeof identity.publicMetadata.role === "string") {
      roles.add(identity.publicMetadata.role);
    }
  }

  // Fallback: Snake_case version
  if (identity.public_metadata) {
    if (Array.isArray(identity.public_metadata.roles)) {
      identity.public_metadata.roles.forEach((r: any) => {
        if (typeof r === "string") roles.add(r);
      });
    }
    if (typeof identity.public_metadata.role === "string") {
      roles.add(identity.public_metadata.role);
    }
  }

  // Fallback: Direct role field on identity
  if (typeof identity.role === "string") {
    roles.add(identity.role);
  }

  return Array.from(roles);
}

/**
 * Check if user has ANY of the required roles
 */
export function hasAnyRole(userRoles: string[], requiredRoles: string[]): boolean {
  return userRoles.some((role) => requiredRoles.includes(role));
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

/** Protocol team = protocol members + admins. They can register and mark attendance. */
export function isProtocolTeam(identity: any): boolean {
  const roles = getUserRoles(identity);
  return roles.includes("admin") || roles.includes("protocol");
}

/** Who can mark attendance. */
export function canMarkAttendance(identity: any): boolean {
  return isProtocolTeam(identity);
}

// ======== Require Helpers (throw if not authorized) ========

export function requireAdmin(identity: any): void {
  if (!isAdmin(identity)) {
    throw new Error("Forbidden: requires admin");
  }
}

export function requireProtocolTeam(identity: any): void {
  if (!isProtocolTeam(identity)) {
    throw new Error("Forbidden: requires protocol or admin role");
  }
}
