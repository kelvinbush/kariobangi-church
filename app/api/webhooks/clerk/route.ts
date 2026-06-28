import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Clerk webhook handler.
 *
 * Kariobangi has no automated onboarding logic, but we keep this endpoint so a
 * configured Clerk webhook does not 404. It verifies the Svix signature and
 * acknowledges the event without taking any action.
 *
 * Secret: set as CLERK_WEBHOOK_SECRET in .env.local.
 */

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

export async function POST(req: Request) {
  if (!WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: any;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err: any) {
    console.error("Webhook verification failed:", err);
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  // No-op: acknowledge the event.
  console.log(`Received Clerk webhook: ${evt.type}`);
  return NextResponse.json({ success: true });
}
