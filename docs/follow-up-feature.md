# Follow-Up Feature — Requirements

This document describes the requirements for the Follow-Up feature: assigning protocol members (Clerk users) to visitors for calls, logging feedback, and tracking progress. Use it as the single source of truth for implementation and future changes.

---

## 1. Roles & Permissions

| Role | Who | Capabilities |
|------|-----|--------------|
| **admin** | Clerk `role === "admin"` | Full access: assign/reassign visitors, remove visitors, approve removal requests, see all follow-ups and feedback, graduate visitors, view all stats and logs. **Only admin can remove a visitor.** |
| **follow-up-admin** | Clerk `role === "follow-up-admin"` | Assign and reassign visitors to protocol members; see all follow-ups and add feedback; **cannot** remove visitors or approve removal requests. |
| **protocol** | Listed in protocol members (Clerk user) | See only **assigned** visitors; add follow-up logs (status + comment); request removal of a visitor (admin must approve and remove). |

- Protocol members are **Clerk users only** (not from the `members` table). They are maintained in a designated list (e.g. `protocolMembers` table keyed by Clerk user ID). **Admin and follow-up-admin are also protocol members**: they can be assigned visitors (e.g. assign to themselves) and can access "My follow-ups" even if not in the protocol list.

---

## 2. Assignment Rules

- **One assignee per visitor** at any time.
- **Reassignment** is supported: a follow-up can be reassigned to another protocol member later.
- Only visitors whose **first visit date** (`visitors.date`) falls within the **past 3 Sundays** are eligible for follow-up assignment.
- **Child visitors** (`relationshipStatus === "child"`) are **excluded** from the follow-up list (we do not assign them for calls). They **can still be graduated** to member when appropriate.

---

## 3. Follow-Up Data

### 3.1 Status (simple)

- `not_contacted`
- `contacted`
- `needs_follow_up`
- `graduated`
- `removed`

### 3.2 Feedback

- **History**: Store a **history** of follow-up entries (who logged what and when).
- Each entry includes:
  - **Status** (from the list above, or a subset for log entries).
  - **Free-text comment** (notes from the call).
  - **Who logged it** (Clerk user ID) and **when** (timestamp).

### 3.3 Who followed who

- Logs must allow reporting:
  - Who followed which visitor (current assignee and history if reassigned).
  - Recent graduates (for admin and for each protocol member).
  - How many visitors graduated from a particular protocol member (over time).

---

## 4. Removal of Visitors

- **Protocol members** can **request** removal of a visitor (e.g. “confirmed won’t be with us”, “travelled”). This sets a removal request with reason; it does not remove the visitor.
- **Only admin** can **remove** a visitor (approve the request and perform the removal). Follow-up-admin cannot remove or approve removal.
- When a visitor is removed:
  - The visitor is removed (or marked inactive/archived as per existing visitor model).
  - The associated follow-up is archived and status set to `removed`.

---

## 5. Graduation

- When a visitor is **graduated** to member:
  - The follow-up is **archived** and status set to `graduated`.
  - **Logs are kept** so we can see who followed the visitor and report “graduates per protocol member”.
- **Dashboard (admin and protocol)**:
  - Show **recent graduates**.
  - Admin can see **how many visitors graduated from a particular protocol member** (and historical view).

---

## 6. Views & UI

### 6.1 Admin follow-up page

- One **admin page** for follow-up management:
  - List all follow-ups (filter by status, protocol member).
  - **Assign**: pick a visitor (from past 3 Sundays, excluding children) and a protocol member.
  - **Reassign**: change assignee for a follow-up.
  - **Removal queue**: list of visitors with pending removal requests; **only admin** can approve and remove.
  - **Recent graduates** and **stats** (e.g. graduates per protocol member).

### 6.2 Protocol: “My follow-ups”

- Each protocol member has a **“My follow-ups”** page:
  - List of **assigned visitors** only.
  - For each: add a follow-up log (status + free-text comment), and optionally **request removal** (reason).
  - **Reminders**: e.g. “X not contacted”, “Y need follow-up”.
  - Optional: show **recent graduates** (visitors I followed who are now graduated).

### 6.3 Reminders & notifications

- Show **reminders** in the UI (e.g. counts of not contacted / need follow-up).
- Offer **browser notifications** (prompt user to enable) for reminders; implementation detail can be decided during build.

---

## 7. Summary of Constraints

- **Protocol members**: Clerk users only; stored in a dedicated list.
- **One assignee per visitor**; reassignment allowed.
- **Eligible visitors**: first visit date in past 3 Sundays; **exclude children** from follow-up list (children can still graduate).
- **Only admin** can remove a visitor (and approve removal requests).
- **History** of status + free text per follow-up; track who followed who; report recent graduates and graduates per protocol member.
- **Archive** follow-ups when visitor is graduated or removed; keep logs for reporting.

---

---

## 8. Setup (post-implementation)

- **Clerk**: Add the `follow-up-admin` role in Clerk (e.g. in user public metadata: `{ "role": "follow-up-admin" }`). Ensure your Convex JWT template includes `role` (e.g. `"role": "{{user.public_metadata.role}}"`) so the backend can enforce permissions.
- **Protocol members**: On the Follow-ups admin page, open the **Protocol members** tab. Add each protocol member by their **Clerk user ID** (from Clerk dashboard → Users → user → ID) and a display name. Only active protocol members appear in the Assign dropdown.

---

*Last updated: requirements locked for implementation. Adjust this doc when scope or rules change.*
