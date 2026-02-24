# Automated Cluster Head Invitations Setup

This guide explains how to configure Clerk for fully automated cluster head invitations - no manual role assignment needed!

## Prerequisites

1. Clerk account with a configured application
2. Convex backend deployed and running
3. Environment variables configured

---

## Step 1: Configure Environment Variables

Add these to your `.env.local` file:

```env
# Clerk (should already be set)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# NEW: Webhook secret (we'll get this in Step 3)
CLERK_WEBHOOK_SECRET=whsec_...

# App URL (for invitation redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Step 2: Enable Invitations in Clerk Dashboard

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Navigate to **User & Authentication** → **Invitation** (in sidebar)
4. Toggle **Enable invitations** to ON
5. Configure invitation settings:
   - **Invitation URL**: Set to your sign-up page (`/sign-up`)
   - **Invitation expiration**: Set to 7 days (or your preference)
6. Save changes

---

## Step 3: Create Webhook Endpoint

1. In Clerk Dashboard, go to **Webhooks** (in sidebar)
2. Click **Add Endpoint**
3. Configure the webhook:
   - **Endpoint URL**: `https://your-domain.com/api/webhooks/clerk`
     - For local development, use ngrok: `https://abc123.ngrok.io/api/webhooks/clerk`
   - **Description**: "Cluster head onboarding"
4. Select events to listen for:
   - ✅ `user.created` - When invited users sign up
   - ✅ `user.updated` - When user metadata changes
   - (Optional) `user.deleted` - For cleanup
5. Click **Create**
6. Copy the **Signing Secret** (starts with `whsec_`)
7. Add it to your `.env.local` as `CLERK_WEBHOOK_SECRET`

### For Local Development with ngrok:

```bash
# Install ngrok if not already installed
npm install -g ngrok

# Start ngrok tunnel to your Next.js dev server
ngrok http 3000

# Copy the https URL (e.g., https://abc123.ngrok.io)
# Use this in Clerk webhook: https://abc123.ngrok.io/api/webhooks/clerk
```

---

## Step 4: Configure JWT Template (Already Done)

Ensure your Clerk JWT template named `convex` includes the role claim:

```json
{
  "role": "{{user.public_metadata.role}}"
}
```

This should already be configured from the original setup.

---

## Step 5: Test the Flow

### 5.1 Create a Cluster

1. Log in as `admin` or `cluster-admin`
2. Go to `/cluster-admin/clusters`
3. Create a new cluster

### 5.2 Invite a Cluster Head

1. Go to `/cluster-admin/heads`
2. Click **Invite Head**
3. Search and select a member (must have email in contact field)
4. (Optional) Pre-assign to a cluster
5. Click **Send Invitation**

### 5.3 What Happens Next

**If the user doesn't have a Clerk account:**
- They receive an email invitation from Clerk
- They click the link and complete sign-up
- Clerk fires `user.created` webhook
- Webhook automatically:
  - Sets their role to `cluster-head`
  - Accepts the invitation in Convex
  - Assigns them as cluster leader (if pre-selected)
- They can immediately access `/cluster-head` dashboard

**If the user already has a Clerk account:**
- They are immediately promoted to `cluster-head`
- They receive no email (they already have access)
- They can immediately access `/cluster-head` dashboard

---

## How It Works

### Architecture Flow

```
Cluster Admin
    ↓
Clicks "Invite Head" in UI
    ↓
POST /api/invite-cluster-head
    ↓
┌─────────────────────────────────────────┐
│ Check if user exists in Clerk           │
├─────────────────────────────────────────┤
│ EXISTS?                                   │
│   YES → Promote immediately               │
│   NO  → Create Clerk invitation           │
└─────────────────────────────────────────┘
    ↓
Store pending invitation in Convex
    ↓
User signs up (via invitation email)
    ↓
Clerk sends user.created webhook
    ↓
POST /api/webhooks/clerk
    ↓
Accept invitation in Convex
    ↓
Assign as cluster leader
    ↓
User is now a cluster head! 🎉
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `/api/invite-cluster-head` | API route for sending invitations |
| `/api/webhooks/clerk` | Receives Clerk webhooks |
| `convex/clerkInvitations.ts` | Stores and manages invitations |
| `acceptByEmail` mutation | Accepts invitation when user signs up |

---

## Troubleshooting

### "Invitation system not configured" Error

**Cause**: Clerk invitations are disabled
**Fix**: Enable invitations in Clerk Dashboard (Step 2)

### Webhook Not Firing

**Cause**: Webhook URL not accessible or events not selected
**Fix**: 
- Verify webhook URL is correct and publicly accessible
- Ensure `user.created` event is selected in webhook settings
- For local dev, ensure ngrok is running

### User Not Getting Role

**Cause**: Webhook secret mismatch
**Fix**: 
- Verify `CLERK_WEBHOOK_SECRET` matches Clerk Dashboard
- Check server logs for webhook verification errors

### "No pending invitation found" Error

**Cause**: Invitation was cancelled or expired
**Fix**: 
- Check invitation status in `/cluster-admin/heads`
- Resend invitation if needed

---

## Security Considerations

1. **Webhook Verification**: All webhooks are verified using Svix signature
2. **Role Checks**: API routes verify the requester is admin/cluster-admin
3. **Email Validation**: Only valid email formats are accepted
4. **Idempotency**: Duplicate invitations are prevented

---

## Advanced: Customizing Invitation Emails

To customize the invitation email sent by Clerk:

1. Go to Clerk Dashboard → **Customization** → **Emails**
2. Select **Invitation** template
3. Customize the email content
4. Use these variables:
   - `{{.Email}}` - Invited user's email
   - `{{.URL}}` - Invitation acceptance link
   - `{{.AppName}}` - Your app name

---

## Summary Checklist

- [ ] Added `CLERK_WEBHOOK_SECRET` to `.env.local`
- [ ] Enabled invitations in Clerk Dashboard
- [ ] Created webhook endpoint in Clerk Dashboard
- [ ] Selected `user.created` and `user.updated` events
- [ ] Configured JWT template with role claim
- [ ] Tested invitation flow end-to-end

Once all steps are complete, cluster head invitations will be **fully automated** with no manual intervention required! 🚀
