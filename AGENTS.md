# Imaara - Church Attendance & Follow-up Management System

> The Imara Daima Main Altar - A full-stack application for tracking church attendance, managing members, and coordinating visitor follow-ups.

---

## Project Overview

**Imaara** is a church management system built to track attendance, manage member records, and coordinate follow-up activities for visitors. The application supports role-based access control with different capabilities for administrators, follow-up administrators, and protocol members.

### Core Features

- **Attendance Tracking**: Mark members, kids, and visitors as present/absent with swipe gestures and keyboard shortcuts
- **Member Management**: Full CRUD for church members and children with CSV import support
- **Visitor Management**: Track first-time and returning visitors, with automatic promotion after 4+ Sunday attendances
- **Follow-up System**: Assign protocol members to visitors for follow-up calls, with status tracking and logging
- **Dashboard & Analytics**: Real-time attendance statistics, demographics charts, visitor retention rates
- **History & Reporting**: View attendance history by date, export data to CSV

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript 5.9 |
| Backend | Convex (serverless with real-time sync) |
| Authentication | Clerk (@clerk/nextjs) |
| Styling | Tailwind CSS v4, Geist fonts |
| Charts | Recharts |
| Icons | Lucide React |

---

## Project Structure

```
/
├── app/                      # Next.js App Router
│   ├── page.tsx             # Dashboard (main page)
│   ├── layout.tsx           # Root layout with Clerk + Convex providers
│   ├── globals.css          # Global styles + Tailwind
│   ├── attendance/          # Attendance marking page
│   │   ├── page.tsx
│   │   └── history/         # Attendance history
│   ├── members/             # Member import
│   ├── kids/                # Kids import
│   ├── visitors/            # Visitor management
│   ├── follow-ups/          # Follow-up management
│   │   ├── page.tsx         # Admin follow-up view
│   │   └── my/page.tsx      # Protocol member's assigned follow-ups
│   ├── master-list/         # Combined member/visitor list
│   ├── worship-pastor/      # Worship pastor dashboard
│   ├── admin/               # Admin pages
│   │   └── visitors/        # Visitors management & graduation
│   └── sign-in/ / sign-up/  # Auth pages
│
├── convex/                  # Backend (Convex)
│   ├── schema.ts           # Database schema
│   ├── auth.config.ts      # Clerk JWT configuration
│   ├── members.ts          # Member CRUD + bulk import
│   ├── kids.ts             # Kids CRUD + bulk import
│   ├── visitors.ts         # Visitor CRUD + graduation to member
│   ├── attendance.ts       # Attendance marking + analytics
│   ├── worship.ts          # Worship team queries and practice attendance
│   ├── followUps.ts        # Follow-up system
│   ├── protocolMembers.ts  # Protocol member management
│   └── _generated/         # Auto-generated Convex types
│
├── components/             # React components
│   ├── ConvexClientProvider.tsx
│   ├── RoleNavigation.tsx   # Role-based sidebar/bottom navigation
│   ├── QuickAddMember.tsx
│   ├── QuickAddKid.tsx
│   ├── QuickAddVisitor.tsx
│   ├── MemberEditor.tsx
│   ├── KidEditor.tsx
│   ├── VisitorEditor.tsx
│   ├── SwipeableMemberCard.tsx
│   ├── AttendanceHistoryModal.tsx
│   └── charts.tsx
│
├── lib/                    # Utilities
│   ├── utils.ts           # cn() for Tailwind classes
│   └── date.ts            # Date formatting helpers
│
├── docs/                   # Documentation
│   └── follow-up-feature.md
│
├── middleware.ts          # Clerk auth middleware
└── package.json
```

---

## Build and Development Commands

```bash
# Install dependencies
npm install

# Development - runs both frontend and backend concurrently
npm run dev
# - frontend: next dev (port 3000)
# - backend: convex dev (with hot reload)
# - predev hook: ensures convex is ready and opens dashboard

# Build for production
npm run build

# Start production server
npm start

# Linting
npm run lint
```

**Package Manager**: The project uses Bun (evident from `bun.lock` file).

---

## Database Schema (Convex)

### Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `members` | Church members | name, contact, gender, residence, department, status, active |
| `kids` | Children | name, contact, residence, age, active |
| `visitors` | First-time/returning visitors | name, contact, residence, relationshipStatus, previousChurch, date |
| `attendance` | Attendance records | memberId, date, present, markedBy, arrivalTime |
| `protocolMembers` | Users who can be assigned follow-ups | clerkId, displayName, active |
| `followUps` | Follow-up assignments | visitorId, assignedToClerkId, status, archived |
| `followUpLogs` | History of follow-up interactions | followUpId, status, comment, loggedByClerkId |
| `practiceAttendance` | Saturday worship practice attendance | memberId, date, present, arrivalTime, notes |

### Indexes

Each table has appropriate indexes for efficient queries (by_name, by_contact, by_active, by_date, by_member_date, etc.)

---

## Authentication & Authorization

### Clerk Integration

- JWT template named `convex` must include `role` claim
- Environment variable `CLERK_JWT_ISSUER_DOMAIN` configured in `.env.local`

### Roles

| Role | Capabilities |
|------|--------------|
| `admin` | Full access: CRUD all data, remove visitors/approve removal requests, view all stats |
| `follow-up-admin` | Assign/reassign visitors, see all follow-ups, add feedback. Can access protocol routes. |
| `protocol` | Mark attendance, view visitors, view members. Can request follow-up assignments. |
| `cluster-head` | Manage their assigned cluster, submit follow-up reports, view cluster members. |
| `cluster-admin` | Create/manage clusters, assign cluster heads, view all cluster data. |
| `fellowship-pastor` | View all clusters (read-only), manage cluster heads, view demographics (youth, married). |
| `worship-pastor` | View worship team attendance with arrival times, mark Saturday practice attendance. |

Roles can be assigned as a single role or multiple roles via the `roles` array in Clerk publicMetadata:
```json
{ "publicMetadata": { "roles": ["protocol", "fellowship-pastor"] } }
```

### Middleware Route Protection

| Route Pattern | Allowed Roles |
|---------------|---------------|
| `/` (Dashboard) | admin only |
| `/attendance`, `/visitors`, `/follow-ups/my` | protocol, follow-up-admin, admin |
| `/follow-ups` (admin view) | follow-up-admin, admin |
| `/cluster-admin(.*)` | cluster-admin, fellowship-pastor, admin |
| `/cluster-head(.*)` | cluster-head, cluster-admin, fellowship-pastor, admin |
| `/fellowship-pastor` | fellowship-pastor, admin |
| `/worship-pastor` | worship-pastor, admin |
| `/admin/visitors` | admin |
| `/youth(.*)`, `/married(.*)` | protocol, follow-up-admin, fellowship-pastor, admin |
| `/members`, `/kids`, `/master-list` | protocol, follow-up-admin, fellowship-pastor, admin |

---

## Worship Team System

The worship pastor role provides specialized access for managing the worship team.

### Worship Team Departments
Members are identified as worship team if their department contains any of these keywords:
- `worship`
- `violinist`
- `keyboardist`
- `singer`
- `choir`
- `band`

### Features

| Feature | Description |
|---------|-------------|
| **Sunday Attendance View** | See worship team attendance with exact arrival times |
| **Saturday Practice Marking** | Mark attendance for Saturday practice sessions with arrival times |
| **Team Statistics** | View breakdown by department and gender |
| **Practice History** | View recent practice sessions and attendance trends |

### Arrival Time Tracking
- When protocol marks someone present, the current time is automatically recorded
- Worship pastor can edit arrival times for practice sessions
- Times are stored in 24-hour format (HH:MM)

---

## Key Development Patterns

### Convex Queries/Mutations

All backend functions follow this pattern:
```typescript
export const myFunction = query({  // or mutation
  args: { /* validators */ },
  returns: v./* return validator */,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    // ...implementation
  },
});
```

### Frontend Data Fetching

Uses Convex React hooks with Clerk auth:
```typescript
const { isAuthenticated } = useConvexAuth();
const data = useQuery(api.module.function, isAuthenticated ? { args } : "skip");
const mutate = useMutation(api.module.function);
```

### Styling Conventions

- Uses Tailwind CSS v4 with `@import "tailwindcss"`
- Custom color scheme: amber/zinc palette (`#F4F1EB`, `#303030`, amber accents)
- Glassmorphism effects: `bg-white/60 backdrop-blur-xl`
- Rounded corners: `rounded-2xl` for cards, `rounded-full` for buttons
- Utility: `cn()` function from `lib/utils.ts` for conditional classes

### Date Handling

ISO date strings (`YYYY-MM-DD`) used throughout:
- `toISODate()` helper for Date → ISO string
- `formatIsoDate()` for display: "15th Feb 2026"
- All attendance is tracked by date (typically Sundays)

---

## Testing

**No formal test suite is currently configured.** Testing is done manually via:

1. Local development (`npm run dev`)
2. Convex dashboard for data inspection
3. Clerk dashboard for user/role management

---

## Security Considerations

1. **Authentication**: All Convex functions check `ctx.auth.getUserIdentity()`
2. **Authorization**: Role checks enforced in mutation handlers
3. **Admin-only operations**: Member/kid/visitor removal requires `admin` role
4. **Environment variables**: 
   - `CLERK_SECRET_KEY` - never expose to client
   - `CLERK_JWT_ISSUER_DOMAIN` - Convex auth config
   - `NEXT_PUBLIC_*` - safe for client

---

## Deployment

### Convex
- Deploy backend with: `npx convex deploy`
- Dev deployment: `dev:polished-gnat-563` (per `.env.local`)

### Next.js
- Build: `next build`
- Static export configured in `next.config.ts`
- Environment variables must be set in production

### Clerk Setup Required
1. Configure JWT template named `convex` with role claim
2. Set `CLERK_JWT_ISSUER_DOMAIN` in Convex dashboard environment variables
3. Add roles to users via Clerk dashboard (public_metadata: `{ role: "admin" }`)

---

## CSV Import Formats

### Members Import
Expected columns: `Name,Contact,Residence,Department,Status,Gender`
- Gender is inferred from name prefixes (Mr, Mrs, Ms, Miss) and department if not provided
- Empty/- values become null

### Kids Import
Expected columns: `Number,Name,Contact,Residence,Age`
- First row auto-detected as header
- Age parsed as number

---

## Follow-up System Details

See `docs/follow-up-feature.md` for complete requirements.

Quick summary:
- Visitors from past 3 Sundays are eligible for follow-up assignment
- Child visitors are excluded from assignment
- One assignee per visitor; can be reassigned
- Status flow: `not_contacted` → `contacted` → `needs_follow_up` → `graduated`
- Protocol members can request removal; only admin can approve

---

## Common Tasks

### Adding a new page
1. Create folder in `app/` with `page.tsx`
2. Use `"use client"` if needed for interactivity
3. Wrap with `SignedIn`/`SignedOut` from Clerk for auth
4. Use `useConvexAuth()` to conditionally fetch data

### Adding a new Convex function
1. Add to appropriate file in `convex/` (or create new)
2. Import `{ query, mutation } from "./_generated/server"`
3. Define args with `v.` validators
4. Run `npx convex dev` to auto-generate types

### Adding a new component
1. Create in `components/` folder
2. Use TypeScript interfaces for props
3. Use `cn()` utility for className merging
4. Follow existing styling patterns (glassmorphism, rounded corners)

---

## Known Limitations

- No automated testing suite
- No formal error boundaries
- CSV import has basic validation only
- Mobile-optimized but tablet experience could be improved
- No offline support

---

## Resources

- [Convex Documentation](https://docs.convex.dev/)
- [Clerk Documentation](https://clerk.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS v4](https://tailwindcss.com/docs/v4-beta)
