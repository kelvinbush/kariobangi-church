# Role-Based Access Control (RBAC) Documentation

> Last updated: 2026-03-06

## Overview

This document defines all roles, their permissions, and which pages/backend functions they can access.

## Quick Reference

| Role | Primary Pages | Backend Access |
|------|--------------|----------------|
| `admin` | All pages | All functions |
| `protocol` | Attendance, Visitors, Master List, My Follow-ups | Protocol team functions |
| `follow-up-admin` | All protocol pages + Admin Follow-up view | All protocol + follow-up admin functions |
| `cluster-head` | My Cluster, Submit Follow-ups | Cluster-specific functions |
| `cluster-admin` | View Clusters (read-only) | View-only cluster functions |
| `fellowship-pastor` | Pastor Dashboard, Demographics, Clusters (view) | View cluster data + demographics |

## Role Storage Format

**Standard Format (Recommended):**
```json
{
  "publicMetadata": {
    "roles": ["protocol", "fellowship-pastor"]
  }
}
```

**Legacy Format (Still Supported):**
```json
{
  "publicMetadata": {
    "role": "protocol"
  }
}
```

Multiple roles are stored in the `roles` array. The system checks if ANY of the user's roles match the required roles for a resource.

---

## Roles

### 1. `admin`
**Description:** Full system access

**Pages Access:**
- `/` (Dashboard/Home)
- `/attendance` - Mark attendance
- `/visitors` - Manage visitors
- `/master-list` - View all members
- `/members/import` - Import members
- `/kids/import` - Import kids
- `/follow-ups` - Admin follow-up management
- `/follow-ups/my` - Personal follow-ups
- `/cluster-admin` - Cluster management
- `/cluster-admin/heads` - Manage cluster heads
- `/cluster-admin/members` - Assign members to clusters
- `/cluster-admin/detail/[id]` - Cluster detail
- `/youth/men`, `/youth/ladies` - Youth demographics
- `/married/men`, `/married/women` - Married demographics
- `/attendance/history` - Attendance history

**Backend Access:**
- All queries and mutations

---

### 2. `protocol`
**Description:** Protocol team - handles attendance and visitors

**Pages Access:**
- `/attendance` - Mark attendance
- `/visitors` - Manage visitors
- `/master-list` - View members
- `/follow-ups/my` - My assigned follow-ups
- `/attendance/history` - View attendance history

**Backend Access:**
- `attendance.ts`: `markPresent`, `unmarkPresent`, `rosterForDate`, `statusForDate`, `summaries`
- `visitors.ts`: `list`, `quickAdd`, `add`, `update` (NOT `remove`)
- `followUps.ts`: `myFollowUps`, `logFollowUp`, `myRecentLogs`, `requestRemoval`
- `members.ts`: `list`, `get` (view only)

---

### 3. `follow-up-admin`
**Description:** Follow-up administrator - manages follow-up assignments

**Pages Access:**
- `/attendance` - Mark attendance
- `/visitors` - Manage visitors
- `/master-list` - View members
- `/follow-ups` - Admin follow-up view (all follow-ups)
- `/follow-ups/my` - Personal follow-ups
- `/attendance/history` - View attendance history

**Backend Access:**
- `attendance.ts`: All attendance functions
- `visitors.ts`: `list`, `quickAdd`, `add`, `update`, `remove`
- `followUps.ts`: All follow-up functions (admin view)
- `members.ts`: `list`, `get`

---

### 4. `cluster-head`
**Description:** Cluster leader - manages their cluster members and follow-ups

**Pages Access:**
- `/cluster-head` - My cluster dashboard
- `/cluster-head/follow-ups` - Submit follow-ups for cluster members

**Backend Access:**
- `clusters.ts`: `myCluster` (their own cluster only)
- `clusterFollowUps.ts`: `getLogs`, `logFollowUp`, `getMemberFollowUpStatus`, `getMyClusterProgress`
- `clusterMembers.ts`: `listByCluster` (their cluster only)
- `attendance.ts`: `markPresent`, `unmarkPresent` (for cluster members)

---

### 5. `cluster-admin`
**Description:** Cluster administrator - manages clusters and assignments

**Pages Access:**
- `/cluster-admin` - All clusters view
- `/cluster-admin/heads` - Manage cluster heads (view only)
- `/cluster-admin/members` - View cluster members
- `/cluster-admin/detail/[id]` - Cluster detail (view only)
- `/youth/men`, `/youth/ladies` - View demographics
- `/married/men`, `/married/women` - View demographics

**Backend Access:**
- `clusters.ts`: `list`, `get`, `stats`, `getClusterMembers`, `getUnassignedMembers` (view only)
- `clusterMembers.ts`: `listByCluster`, `unassignedMembers` (view only)
- `clusterFollowUps.ts`: `getLogs`, `getAllClustersProgress` (view only)

**Admin-Only Mutations (NOT allowed):**
- `clusters.create`
- `clusters.assignLeader`
- `clusters.removeLeader`
- `clusters.archive`
- `clusterHeads.add`
- `clusterHeads.archive`
- `clusterHeads.reactivate`

---

### 6. `fellowship-pastor`
**Description:** Fellowship pastor - oversees demographics and can be cluster head

**Pages Access:**
- `/fellowship-pastor` - Pastor dashboard
- `/cluster-admin` - View clusters (read-only)
- `/cluster-admin/detail/[id]` - View cluster details (read-only)
- `/youth/men`, `/youth/ladies` - Youth demographics
- `/married/men`, `/married/women` - Married demographics
- `/cluster-head` - If assigned as cluster head

**Backend Access:**
- `clusters.ts`: `list`, `get`, `stats`, `myCluster` (view only)
- `clusterFollowUps.ts`: `getLogs`, `getAllClustersProgress` (view only), `logFollowUp` (if cluster head)
- `clusterMembers.ts`: `listByCluster` (view only)

---

## Multi-Role Combinations

### `protocol` + `fellowship-pastor`
**Use Case:** Protocol team member who is also a fellowship pastor

**Effective Permissions:**
- All `protocol` pages
- All `fellowship-pastor` pages
- Can switch between protocol duties and pastor duties

**Backend:** Both role checks pass

### `follow-up-admin` + `protocol`
**Use Case:** Senior protocol member with follow-up admin rights

**Effective Permissions:**
- All `follow-up-admin` pages (includes admin follow-up view)
- All `protocol` pages

**Backend:** Both role checks pass

### `fellowship-pastor` + `cluster-head`
**Use Case:** Pastor who leads a cluster

**Effective Permissions:**
- Pastor dashboard
- Cluster head dashboard
- Can view demographics AND manage cluster

**Backend:** Both role checks pass

---

## Backend Helper Functions

### Centralized Auth Helpers (`convex/authHelpers.ts`)

All backend files should import from `authHelpers.ts`:

```typescript
import { getUserRoles, hasAnyRole, isAdmin, isProtocolTeam } from "./authHelpers";
```

### Available Helpers

| Helper | Description |
|--------|-------------|
| `getUserRoles(identity)` | Returns array of all user roles |
| `hasAnyRole(userRoles, requiredRoles)` | Checks if user has ANY of the required roles |
| `hasAllRoles(userRoles, requiredRoles)` | Checks if user has ALL of the required roles |
| `isAdmin(identity)` | Check admin role |
| `isProtocolTeam(identity)` | Check protocol, follow-up-admin, or admin |
| `isFollowUpAdmin(identity)` | Check follow-up-admin or admin |
| `isClusterAdmin(identity)` | Check cluster-admin, fellowship-pastor, or admin |
| `isClusterHead(identity)` | Check cluster-head, fellowship-pastor, or admin |
| `isFellowshipPastor(identity)` | Check fellowship-pastor or admin |
| `requireAdmin(identity)` | Throw if not admin |
| `requireProtocolTeam(identity)` | Throw if not protocol team |
| `requireFollowUpAdmin(identity)` | Throw if not follow-up admin |
| `requireClusterAdmin(identity)` | Throw if not cluster admin |
| `requireClusterHead(identity)` | Throw if not cluster head |

### Usage Examples

**Check roles in a query:**
```typescript
export const myQuery = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    // Option 1: Use helper function
    if (!isProtocolTeam(identity)) {
      throw new Error("Forbidden: requires protocol team");
    }
    
    // Option 2: Use require helper (throws automatically)
    requireProtocolTeam(identity);
    
    // ... rest of handler
  }
});
```

**Check specific roles:**
```typescript
const userRoles = getUserRoles(identity);
if (!hasAnyRole(userRoles, ["protocol", "follow-up-admin"])) {
  throw new Error("Forbidden");
}
```

---

## Page to Backend Mapping

| Page | Required Roles | Backend Queries/Mutations |
|------|---------------|---------------------------|
| `/` | `admin` | `attendance.summaries`, `attendance.rosterForDate` |
| `/attendance` | `protocol`, `follow-up-admin`, `admin` | `attendance.markPresent`, `attendance.unmarkPresent`, `attendance.statusForDate` |
| `/visitors` | `protocol`, `follow-up-admin`, `admin` | `visitors.list`, `visitors.quickAdd`, `visitors.add`, `visitors.update` |
| `/master-list` | `protocol`, `follow-up-admin`, `admin` | `members.list`, `kids.list` |
| `/follow-ups` | `follow-up-admin`, `admin` | `followUps.list`, `followUps.assign`, `followUps.getAssignableVisitors` |
| `/follow-ups/my` | `protocol`, `follow-up-admin`, `admin` | `followUps.myFollowUps`, `followUps.logFollowUp` |
| `/cluster-head` | `cluster-head`, `fellowship-pastor` (as head) | `clusters.myCluster`, `clusterFollowUps.getLogs` |
| `/cluster-head/follow-ups` | `cluster-head`, `fellowship-pastor` (as head) | `clusterFollowUps.logFollowUp`, `clusterFollowUps.getMemberFollowUpStatus` |
| `/cluster-admin` | `cluster-admin`, `fellowship-pastor`, `admin` | `clusters.list`, `clusters.stats`, `clusterFollowUps.getAllClustersProgress` |
| `/cluster-admin/detail/[id]` | `cluster-admin`, `fellowship-pastor`, `admin` | `clusters.get`, `clusterMembers.listByCluster`, `clusterFollowUps.getLogs` |
| `/fellowship-pastor` | `fellowship-pastor` | `clusters.list`, `clusterFollowUps.getAllClustersProgress` |

---

## Common Issues & Solutions

### Issue: "Forbidden: requires X" error
**Cause:** Backend checking only single `role` field instead of `roles` array

**Solution:** Update backend to use `getUserRoles()` helper

### Issue: Page loads but data fetch fails
**Cause:** Backend mutation allows access but query doesn't

**Solution:** Ensure both query and mutation have same role check

### Issue: Multi-role user can't access page
**Cause:** Frontend or backend only checks for single role

**Solution:** Use `hasAnyRole(userRoles, ["role1", "role2"])` pattern

---

## Testing Checklist

- [ ] `admin` can access all pages
- [ ] `protocol` can access attendance, visitors, master-list, my follow-ups
- [ ] `follow-up-admin` can access all protocol pages + admin follow-up view
- [ ] `cluster-head` can access cluster-head dashboard and submit follow-ups
- [ ] `cluster-admin` can view clusters but NOT create/assign (admin only)
- [ ] `fellowship-pastor` can view clusters, demographics
- [ ] `protocol` + `fellowship-pastor` can access both sets of pages
- [ ] `fellowship-pastor` + `cluster-head` can access both sets of pages
- [ ] User with no role is redirected to `/no-role`

---

## Troubleshooting

### "Forbidden: requires X" Error

**Cause:** User's role is not in the allowed list for that resource.

**Solution:** 
1. Check user's roles in Clerk Dashboard
2. Verify the backend function uses `isX()` helper from `authHelpers.ts`
3. Ensure middleware allows the role for that route

### "Cannot find name 'getRoleFromIdentity'" Error

**Cause:** File still uses old role checking pattern.

**Solution:** Update imports:
```typescript
// Old
function getRoleFromIdentity(identity: any) { ... }

// New
import { getUserRoles, isAdmin, isProtocolTeam } from "./authHelpers";
```

### Multi-Role User Can't Access Page

**Cause:** Backend only checks for single role instead of using `hasAnyRole()`.

**Solution:** 
```typescript
// Wrong
if (role !== "protocol" && role !== "follow-up-admin") { ... }

// Correct
if (!isProtocolTeam(identity)) { ... }
```
