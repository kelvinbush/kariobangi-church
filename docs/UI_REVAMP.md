# Imaara UI Revamp Plan

> Comprehensive redesign and navigation consolidation to use Smart Navigation (RoleNavigation) as the primary navigation pattern.

---

## Overview

### Goals
1. **Consolidate Navigation**: Use RoleNavigation as the primary navigation for all role-based access
2. **Remove Redundant Navbars**: Eliminate duplicate navigation links within individual pages
3. **Simplify Page Headers**: Convert page-specific headers to simple title bars (Back button + Title + UserButton)
4. **Permission-Based Access**: Ensure users only see navigation links to pages they have access to
5. **Consistent Design**: Apply clean, minimal design across all pages

### Design Philosophy
- **Mobile-First**: Bottom navigation on mobile, sidebar on desktop
- **Minimal Headers**: No page-level navigation bars (use RoleNavigation instead)
- **Contextual Navigation**: Only show "Back" buttons for detail pages or nested flows
- **Clean Palette**: Continue using the warm neutral theme (`#f9f8f6`, `#7c6f5a`, etc.)

---

## Page Inventory & Navigation Mapping

### Legend
- ✅ **Uses AuthenticatedLayout** (has RoleNavigation)
- ❌ **Custom Header/Nav** (needs revamp)
- 🔴 **To Be Removed**
- 🟡 **To Be Modified**
- 🟢 **Good as-is**

---

### 1. Main Application Pages

| Page | Path | Layout | Nav Status | Action | Priority |
|------|------|--------|------------|--------|----------|
| Dashboard | `/` | Custom Header | ❌ | Add AuthenticatedLayout | High |
| Fellowship Pastor | `/fellowship-pastor` | Custom Header | ❌ | Add AuthenticatedLayout, simplify header | High |
| Cluster Admin | `/cluster-admin` | Custom Header | ❌ | Add AuthenticatedLayout | High |
| Cluster Detail | `/cluster-admin/detail/[id]` | Custom Header | ❌ | Keep simple header (Back + Title) | Medium |
| Clusters List | `/cluster-admin/clusters` | Custom Header | ❌ | Add AuthenticatedLayout | Medium |
| Cluster Heads | `/cluster-admin/heads` | Custom Header | ❌ | Add AuthenticatedLayout | Medium |
| Cluster Members | `/cluster-admin/members` | Custom Header | 🔴 | **Remove page entirely** | High |
| Cluster Head | `/cluster-head` | Custom Header | ❌ | Add AuthenticatedLayout | High |
| Cluster Head Follow-ups | `/cluster-head/follow-ups` | Custom Header | ❌ | Add AuthenticatedLayout | Medium |
| Attendance | `/attendance` | ✅ AuthenticatedLayout | 🟢 | Good - keep as-is | - |
| Attendance History | `/attendance/history` | Custom Header | ❌ | Add AuthenticatedLayout | Medium |
| Attendance History Date | `/attendance/history/[date]` | Custom Header | ❌ | Add AuthenticatedLayout | Medium |
| Visitors | `/visitors` | ✅ AuthenticatedLayout | 🟢 | Good - keep as-is | - |
| Master List | `/master-list` | Custom Header | ❌ | Add AuthenticatedLayout | High |
| Follow-ups | `/follow-ups` | Custom Header | ❌ | Add AuthenticatedLayout | High |
| My Follow-ups | `/follow-ups/my` | Custom Header | ❌ | Add AuthenticatedLayout | High |
| Youth Men | `/youth/men` | Custom Header | ❌ | Add AuthenticatedLayout | Medium |
| Youth Ladies | `/youth/ladies` | Custom Header | ❌ | Add AuthenticatedLayout | Medium |
| Married Men | `/married/men` | Custom Header | ❌ | Add AuthenticatedLayout | Medium |
| Married Women | `/married/women` | Custom Header | ❌ | Add AuthenticatedLayout | Medium |

### 2. Utility Pages (No changes needed)

| Page | Path | Notes |
|------|------|-------|
| Sign In | `/sign-in/[[...sign-in]]` | Clerk default - no changes |
| Sign Up | `/sign-up/[[...sign-up]]` | Clerk default - no changes |
| No Role | `/no-role` | Simple page - no changes |
| Server | `/server` | Server-side test page - no changes |

### 3. Import Pages (Keep simple)

| Page | Path | Action |
|------|------|--------|
| Member Import | `/members/import` | Add simple header + Back button |
| Kids Import | `/kids/import` | Add simple header + Back button |

---

## RoleNavigation Updates Required

### Current RoleNavigation Items

| Link | Path | Visible To | Status |
|------|------|------------|--------|
| Dashboard | `/` | admin | ✅ Keep |
| Attendance | `/attendance` | protocol, follow-up-admin, admin | ✅ Keep |
| Visitors | `/visitors` | protocol, follow-up-admin, admin | ✅ Keep |
| Members | `/master-list` | protocol, follow-up-admin, admin | ✅ Keep |
| Follow-ups | `/follow-ups` | follow-up-admin, admin | ✅ Keep |
| My Follow-ups | `/follow-ups/my` | protocol, follow-up-admin, admin | ✅ Keep |
| My Cluster | `/cluster-head` | cluster-head | ✅ Keep |
| Clusters | `/cluster-admin` | cluster-admin, admin | 🟡 **Add fellowship-pastor** |
| Pastor | `/fellowship-pastor` | fellowship-pastor | ✅ Keep |
| Youth Men | `/youth/men` | fellowship-pastor, admin, cluster-admin | ✅ Keep |
| Married Men | `/married/men` | fellowship-pastor, admin, cluster-admin | ✅ Keep |

### RoleNavigation Changes Needed

1. **Add for Fellowship Pastor**:
   - Clusters (`/cluster-admin`) - view-only access
   - Cluster Heads (`/cluster-admin/heads`) - view-only access
   - Youth Ladies (`/youth/ladies`)
   - Married Women (`/married/women`)

2. **Update Role Permissions**:
   ```typescript
   // Add fellowship-pastor to cluster-admin items
   {
     href: "/cluster-admin",
     label: "Clusters",
     roles: ["cluster-admin", "admin", "fellowship-pastor"], // Add fellowship-pastor
   }
   
   // Add new navigation items for fellowship-pastor
   {
     href: "/cluster-admin/heads",
     label: "Cluster Heads",
     roles: ["cluster-admin", "admin", "fellowship-pastor"],
   }
   {
     href: "/youth/ladies",
     label: "Youth Ladies",
     roles: ["fellowship-pastor", "admin", "cluster-admin"],
   }
   {
     href: "/married/women",
     label: "Married Women",
     roles: ["fellowship-pastor", "admin", "cluster-admin"],
   }
   ```

---

## Backend Permission Updates

### fellowship-pastor needs view access to:

| Resource | Current | Needed |
|----------|---------|--------|
| clusters.list | cluster-admin, admin | + fellowship-pastor |
| clusters.get | cluster-admin, admin | + fellowship-pastor |
| clusterHeads.list | cluster-admin, admin | + fellowship-pastor |
| clusterHeads.myClusterHead | all authenticated | keep as-is |

### Files to Update

- `convex/clusters.ts` - Add `fellowship-pastor` to `list`, `get`, `stats`
- `convex/clusterHeads.ts` - Add `fellowship-pastor` to `list`

---

## Page Revamp Checklist

### Phase 1: Core Pages (High Priority)

- [ ] **Dashboard** (`/app/page.tsx`)
  - [ ] Wrap with AuthenticatedLayout
  - [ ] Remove custom header/navigation
  - [ ] Simplify to title + stats cards

- [ ] **Fellowship Pastor** (`/app/fellowship-pastor/page.tsx`)
  - [ ] Wrap with AuthenticatedLayout
  - [ ] Remove custom header (keep simple Back + Title)
  - [ ] Update grid layout to match new design

- [ ] **Cluster Admin** (`/app/cluster-admin/page.tsx`)
  - [ ] Wrap with AuthenticatedLayout
  - [ ] Remove custom header
  - [ ] Simplify navigation (remove tabs, use RoleNavigation instead)

- [ ] **Cluster Head** (`/app/cluster-head/page.tsx`)
  - [ ] Wrap with AuthenticatedLayout
  - [ ] Remove custom header

- [ ] **Master List** (`/app/master-list/page.tsx`)
  - [ ] Wrap with AuthenticatedLayout
  - [ ] Remove custom header

- [ ] **Follow-ups** (`/app/follow-ups/page.tsx`)
  - [ ] Wrap with AuthenticatedLayout
  - [ ] Remove custom header

- [ ] **My Follow-ups** (`/app/follow-ups/my/page.tsx`)
  - [ ] Wrap with AuthenticatedLayout
  - [ ] Remove custom header

### Phase 2: Demographics Pages (Medium Priority)

- [ ] **Youth Men** (`/app/youth/men/page.tsx`)
  - [ ] Wrap with AuthenticatedLayout
  - [ ] Remove custom header

- [ ] **Youth Ladies** (`/app/youth/ladies/page.tsx`)
  - [ ] Wrap with AuthenticatedLayout
  - [ ] Remove custom header

- [ ] **Married Men** (`/app/married/men/page.tsx`)
  - [ ] Wrap with AuthenticatedLayout
  - [ ] Remove custom header

- [ ] **Married Women** (`/app/married/women/page.tsx`)
  - [ ] Wrap with AuthenticatedLayout
  - [ ] Remove custom header

### Phase 3: Supporting Pages (Medium Priority)

- [ ] **Cluster Detail** (`/app/cluster-admin/detail/[id]/page.tsx`)
  - [ ] Keep simple header (Back button + Title + Actions)
  - [ ] Wrap content area with AuthenticatedLayout
  - [ ] Remove full custom navbar

- [ ] **Clusters List** (`/app/cluster-admin/clusters/page.tsx`)
  - [ ] Wrap with AuthenticatedLayout
  - [ ] Remove custom header

- [ ] **Cluster Heads** (`/app/cluster-admin/heads/page.tsx`)
  - [ ] Wrap with AuthenticatedLayout
  - [ ] Remove custom header

- [ ] **Attendance History** (`/app/attendance/history/page.tsx`)
  - [ ] Wrap with AuthenticatedLayout
  - [ ] Remove custom header

- [ ] **Attendance History Date** (`/app/attendance/history/[date]/page.tsx`)
  - [ ] Wrap with AuthenticatedLayout
  - [ ] Remove custom header

### Phase 4: Backend Updates (High Priority)

- [ ] **Update RoleNavigation** (`/components/RoleNavigation.tsx`)
  - [ ] Add fellowship-pastor to cluster routes
  - [ ] Add Youth Ladies link
  - [ ] Add Married Women link
  - [ ] Add Cluster Heads link

- [ ] **Update Backend Permissions**
  - [ ] `convex/clusters.ts` - Add fellowship-pastor to queries
  - [ ] `convex/clusterHeads.ts` - Add fellowship-pastor to list query

### Phase 5: Cleanup (High Priority)

- [ ] **Remove Cluster Admin Members Page**
  - [ ] Delete `/app/cluster-admin/members/page.tsx`
  - [ ] Remove from middleware if referenced
  - [ ] Remove any links to this page

---

## Standard Page Header Pattern

All pages using AuthenticatedLayout should have this simplified header:

```tsx
// Standard header for pages with AuthenticatedLayout
<header className="sticky top-0 z-30 border-b bg-white px-4 h-14 flex items-center justify-between">
  <div className="flex items-center gap-3">
    <Link href="/" className="text-sm text-gray-600">
      Back
    </Link>
    <h1 className="text-base font-medium">Page Title</h1>
  </div>
  <SignedIn>
    <UserButton />
  </SignedIn>
</header>
```

### Exception: Detail Pages

Detail pages (like `/cluster-admin/detail/[id]`) can keep action buttons:

```tsx
<header className="sticky top-0 z-30 border-b bg-white px-4 h-14 flex items-center justify-between">
  <div className="flex items-center gap-3">
    <Link href="/cluster-admin" className="text-sm text-gray-600">
      Back
    </Link>
    <h1 className="text-base font-medium">Cluster Name</h1>
  </div>
  <div className="flex items-center gap-2">
    {/* Contextual actions */}
    <button>Edit</button>
    <SignedIn>
      <UserButton />
    </SignedIn>
  </div>
</header>
```

---

## Implementation Order (Recommended)

### Step 1: Foundation (Do First)
1. Update RoleNavigation with new links
2. Update backend permissions for fellowship-pastor
3. Delete `/cluster-admin/members` page

### Step 2: Core Pages
1. Dashboard (`/`)
2. Fellowship Pastor (`/fellowship-pastor`)
3. Cluster Admin (`/cluster-admin`)
4. Cluster Head (`/cluster-head`)

### Step 3: Supporting Pages
1. Master List
2. Follow-ups
3. My Follow-ups
4. Attendance History

### Step 4: Demographics
1. Youth Men/Ladies
2. Married Men/Women

### Step 5: Detail Pages
1. Cluster Detail
2. Clusters List
3. Cluster Heads

---

## Notes

- **Always test on mobile** - The RoleNavigation bottom bar should appear
- **Keep Back buttons** - For nested pages, always provide a way back
- **No double navigation** - If using AuthenticatedLayout, don't add custom navbars
- **Simple headers** - Title + Back + UserButton is the standard pattern

---

## Questions to Resolve

1. Should `/cluster-admin` show a different view for fellowship-pastor (read-only)?
2. Should we add a "Back to Dashboard" link on all pages or rely on RoleNavigation?
3. Do we need breadcrumbs for deeply nested pages (e.g., cluster → member → follow-up)?
