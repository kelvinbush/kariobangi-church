# Kariobangi Church — Attendance Management System

> A focused full-stack app for the Kariobangi protocol team to register members, kids, and
> visitors and to track Sunday attendance. Forked from the larger Imara system and trimmed to
> the attendance workflow only (no follow-up, clusters, worship, or fellowship-pastor modules).

---

## Project Overview

The protocol team uses this app to:

- **Register** church members, kids, and visitors.
- **Mark attendance** each Sunday (members, kids, returning visitors) with arrival times.
- **Review history** by date and basic attendance stats.

Two roles only: `protocol` (register + mark) and `admin` (full access + dashboard).

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js (App Router), React, TypeScript |
| Backend | Convex (serverless, real-time sync) |
| Auth | Clerk (`@clerk/nextjs`) |
| Styling | Tailwind CSS v4, Geist fonts |
| Charts | Recharts |
| Icons | Lucide React |

---

## Project Structure

```
/
├── app/
│   ├── page.tsx              # Admin dashboard (last Sunday + recent Sundays)
│   ├── layout.tsx            # Root layout (Clerk + Convex providers)
│   ├── attendance/           # Mark attendance + history/[date]
│   ├── visitors/             # Visitor management
│   ├── members/              # Member registration / import
│   ├── kids/                 # Kids registration / import
│   ├── no-role/              # Shown to users without a role
│   ├── api/
│   │   ├── webhooks/clerk/   # No-op signed Clerk webhook (acknowledges only)
│   │   └── debug-session/
│   └── sign-in/ , sign-up/
│
├── convex/
│   ├── schema.ts             # Tables: members, kids, attendance, visitors
│   ├── auth.config.ts        # Clerk JWT config
│   ├── authHelpers.ts        # Role helpers (protocol + admin)
│   ├── pipelineHelpers.ts    # Date helpers (todayISO, isSunday, ...)
│   ├── members.ts , kids.ts , visitors.ts
│   └── attendance.ts         # Attendance marking + analytics
│
├── components/               # AuthenticatedLayout, RoleNavigation, QuickAdd*, *Editor,
│                             # SwipeableMemberCard, AttendanceHistoryModal, charts, ui/
├── lib/                      # date.ts, utils.ts
└── middleware.ts             # Clerk route protection (protocol + admin)
```

---

## Build and Development

```bash
bun install
bun run dev        # next dev + convex dev in parallel
bun run build
bun run lint
```

---

## Database Schema (Convex)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `members` | Church members | name, contact, gender, residence, department, status, active |
| `kids` | Children | name, contact, residence, age, active |
| `visitors` | First-time / returning visitors | name, contact, residence, relationshipStatus, date, sundayCount |
| `attendance` | Attendance records | memberId (member/kid/visitor), date, present, markedBy, arrivalTime |

---

## Authentication & Authorization

- Clerk JWT template named `convex` must include the `role`/`roles` claim.
- `CLERK_JWT_ISSUER_DOMAIN` set in Convex dashboard env vars.

### Roles

| Role | Capabilities |
|------|--------------|
| `protocol` | Register members/kids/visitors, mark attendance, view visitors & history. |
| `admin` | Everything protocol can do, plus the dashboard at `/`. |

Assign via Clerk `publicMetadata`: `{ "roles": ["protocol"] }` or `{ "role": "admin" }`.

### Route protection (`middleware.ts`)

| Route | Allowed |
|-------|---------|
| `/` (dashboard) | admin (protocol redirected to `/attendance`) |
| `/attendance(.*)`, `/visitors(.*)`, `/members(.*)`, `/kids(.*)` | protocol, admin |
| `/sign-in`, `/sign-up`, `/api`, `/no-role` | public |

Convex functions also enforce roles via `authHelpers` (`isProtocolTeam`, `isAdmin`,
`canMarkAttendance`, `requireAdmin`).

---

## Key Patterns

### Convex functions
```typescript
export const myFn = query({ // or mutation
  args: { /* v. validators */ },
  returns: v./* validator */,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    // ...
  },
});
```

### Frontend data fetching
```typescript
const { isAuthenticated } = useConvexAuth();
const data = useQuery(api.module.fn, isAuthenticated ? { args } : "skip");
const mutate = useMutation(api.module.fn);
```

### Dates
ISO date strings (`YYYY-MM-DD`) throughout. Helpers in `lib/date.ts` and
`convex/pipelineHelpers.ts` (`todayISO`, `isSunday`).

---

## Notes

- No automated test suite; verify via `bun run build`, `bunx convex dev --once`, and manual testing.
- The Clerk webhook route is a no-op that only verifies the signature and returns 200, kept so a
  configured Clerk endpoint does not 404.
- Department dropdown lists in the member/kid editors are church-specific data — update them to
  match Kariobangi's ministries as needed.
