# Kariobangi Church — Attendance

A focused church attendance app for the Kariobangi protocol team. The protocol team
**registers members, kids, and visitors** and **marks Sunday attendance**. The app is scoped
to the attendance, visitor, and history workflows only.

## Stack

- [Next.js](https://nextjs.org/) (App Router) + React + TypeScript
- [Convex](https://convex.dev/) — backend database & server functions
- [Clerk](https://clerk.com/) — authentication & roles
- [Tailwind CSS](https://tailwindcss.com/)

## Roles

| Role | Capabilities |
|------|--------------|
| `protocol` | Register members/kids/visitors, mark attendance, view history. Lands on `/attendance`. |
| `admin` | Everything `protocol` can do, plus the dashboard at `/`. |

Assign roles in Clerk `publicMetadata`, e.g. `{ "roles": ["protocol"] }` or `{ "role": "admin" }`.

## Routes

- `/` — admin dashboard (last Sunday stats + recent Sundays)
- `/attendance` — mark attendance (members, kids, visitors); `/attendance/history/[date]`
- `/visitors`, `/members`, `/kids` — registration / management

## Develop

```bash
bun install
bun run dev        # runs next dev + convex dev
```

Required `.env.local` keys: `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`,
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER_DOMAIN`,
the Clerk sign-in/up URL vars, and `CLERK_WEBHOOK_SECRET`.

In the Convex dashboard, set `CLERK_JWT_ISSUER_DOMAIN` and ensure a `convex` JWT template
exists in Clerk that includes the `role`/`roles` claim.

## Build

```bash
bun run build
bun run lint
```
