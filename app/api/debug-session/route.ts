import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  
  return NextResponse.json({
    userId: session.userId,
    sessionClaims: session.sessionClaims,
    publicMetadata: (session.sessionClaims?.publicMetadata as any) || {},
    role: (session.sessionClaims?.publicMetadata as any)?.role || "not set",
    allClaimKeys: Object.keys(session.sessionClaims || {}),
  });
}
