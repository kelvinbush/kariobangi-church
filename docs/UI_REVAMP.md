# Imaara UI Revamp Plan

> Comprehensive redesign with a minimal, warm aesthetic focused on clarity and calm.

---

## Style Guide (Established)

### Design Philosophy
- **Minimal & Calm**: No clutter, no unnecessary elements
- **Soft & Warm**: Muted earth tones, no harsh contrasts
- **Light Typography**: No bold weights, rely on size and color for hierarchy
- **Breathing Room**: Generous spacing, content never feels cramped

### Color Palette

```typescript
const colors = {
  // Backgrounds
  bg: '#f5f3ef',           // Main page background (warm off-white)
  surface: '#faf9f7',      // Card backgrounds (slightly lighter)
  surfaceHover: '#f0ede8', // Hover states
  
  // Text
  text: {
    primary: '#3d3a36',    // Main text (warm charcoal)
    secondary: '#6b6864',  // Subheadings, labels
    muted: '#9a9793',      // Hints, metadata
  },
  
  // Accents (all muted, desaturated)
  accent: {
    amber: '#c9a87c',        // Primary accent
    amberLight: '#e8dcc8',   // Backgrounds, highlights
    sage: '#9db88c',         // Success, growth
    sageLight: '#d4e4c8',
    terracotta: '#c49a84',   // Secondary accent
    terracottaLight: '#e8d8cc',
    blue: '#8fa8c4',         // Cool accents
    blueLight: '#d4e0ec',
  }
};
```

### Visual Elements

**Background Pattern:**
- Subtle dot pattern at 1.5% opacity
- Creates texture without distraction

```tsx
const DotPattern = () => (
  <svg className="absolute inset-0 w-full h-full opacity-[0.015]">
    <defs>
      <pattern id="dotPattern" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1" fill="currentColor"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dotPattern)"/>
  </svg>
);
```

**Borders:**
- NO borders on cards
- Use background color differences instead
- Header border: `rgba(61, 58, 54, 0.06)` (very subtle)

**Shadows:**
- NO shadows anywhere
- Use hover background color changes instead

**Icons:**
- NO emojis
- Simple SVG line icons only (stroke-width: 1.5)
- Minimal icon usage - only when necessary

### Typography

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Page Title | 2xl (24px) | font-light (300) | text.primary |
| Section Label | sm (14px) | normal | text.secondary |
| Large Stat | 5xl (48px) | font-light (300) | text.primary |
| Body Text | sm (14px) | normal | text.primary |
| Metadata | xs (12px) | normal | text.muted |
| Links | sm (14px) | normal | text.secondary |

**NO bold weights anywhere**

### Spacing

- Page padding: `px-5 py-8`
- Mobile bottom padding: `pb-24` (for bottom nav)
- Card padding: `p-6`
- Section gaps: `mb-8`
- Item gaps: `gap-3` or `gap-4`

### Component Patterns

**Header:**
```tsx
<header 
  className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between"
  style={{ 
    backgroundColor: colors.bg,
    borderBottom: `1px solid rgba(61, 58, 54, 0.06)`
  }}
>
  <span className="text-sm tracking-wide" style={{ color: colors.text.secondary }}>
    Page Title
  </span>
  <UserButton />
</header>
```

**Card (No Border):**
```tsx
<div 
  className="rounded-2xl p-6"
  style={{ backgroundColor: colors.surface }}
>
  {/* Content */}
</div>
```

**Progress Bar:**
```tsx
<div 
  className="h-1 rounded-full"
  style={{ backgroundColor: 'rgba(201, 168, 124, 0.2)' }}
>
  <div 
    className="h-full rounded-full"
    style={{ width: `${percentage}%`, backgroundColor: colors.accent.amber }}
  />
</div>
```

**Group Link Button:**
```tsx
<Link
  href="/path"
  className="block p-4 rounded-xl transition-colors"
  style={{ backgroundColor: colors.accent.amberLight }}
>
  <span className="text-sm" style={{ color: colors.text.primary }}>
    Label
  </span>
</Link>
```

### Layout Structure

```tsx
<AuthenticatedLayout>
  {/* Background */}
  <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: colors.bg }}>
    <DotPattern />
  </div>

  <div className="relative min-h-screen">
    {/* Header */}
    <header>...</header>

    {/* Main Content */}
    <main className="max-w-2xl mx-auto px-5 py-8 pb-24">
      {/* Greeting */}
      {/* Main Stats */}
      {/* Sections... */}
    </main>
  </div>
</AuthenticatedLayout>
```

### Mobile Considerations

- Always include `pb-24` on main content (bottom nav clearance)
- Touch targets minimum 44px
- Horizontal padding: `px-5` (20px)
- Cards should be full-width on mobile

---

## Revamp Progress

### Phase 1: Core Pages ✅ COMPLETE

| Page | Status | Notes |
|------|--------|-------|
| Dashboard (`/`) | ✅ Complete | Style guide established |
| Fellowship Pastor (`/fellowship-pastor`) | ✅ Complete | Same minimal style applied |
| Cluster Admin (`/cluster-admin`) | ✅ Complete | Combined stats, Sunday selector |
| Cluster Head (`/cluster-head`) | ✅ Complete | Member list, attendance modals |

### Phase 2: Supporting Pages

| Page | Status | Notes |
|------|--------|-------|
| Master List (`/master-list`) | ✅ Complete | Simplified filters, clean list view |
| Follow-ups (`/follow-ups`) | ⏳ Pending | |
| My Follow-ups (`/follow-ups/my`) | ⏳ Pending | |
| Attendance History (`/attendance/history`) | ⏳ Pending | |

### Phase 3: Demographics Pages

| Page | Status | Notes |
|------|--------|-------|
| Youth Men (`/youth/men`) | ⏳ Pending | |
| Youth Ladies (`/youth/ladies`) | ⏳ Pending | |
| Married Men (`/married/men`) | ⏳ Pending | |
| Married Women (`/married/women`) | ⏳ Pending | |

### Phase 4: Detail Pages

| Page | Status | Notes |
|------|--------|-------|
| Cluster Detail (`/cluster-admin/detail/[id]`) | ⏳ Pending | Keep simple header |
| Cluster Heads (`/cluster-admin/heads`) | ⏳ Pending | |

### Phase 5: Cleanup

| Task | Status | Notes |
|------|--------|-------|
| Remove `/cluster-admin/members` | ✅ Complete | Page deleted |
| Update RoleNavigation | ✅ Complete | Fellowship-pastor access added |
| Backend permissions | ✅ Complete | Middleware updated |

---

## Common Mistakes to Avoid

1. **NO bold text** - Use font-light or normal only
2. **NO borders on cards** - Use background colors
3. **NO shadows** - Ever
4. **NO emojis** - Use SVG icons sparingly
5. **NO quick actions** - If they're in the navbar
6. **Always include pb-24** - For mobile bottom nav
7. **Header matches page bg** - Not white
8. **Stats in one card** - Not individual cards

---

## Files to Reference

- `/app/page.tsx` - The reference implementation
- `/components/RoleNavigation.tsx` - Navigation patterns
