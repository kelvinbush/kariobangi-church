"use client";

import { useUser } from "@clerk/nextjs";
import RoleNavigation from "./RoleNavigation";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { isLoaded, isSignedIn } = useUser();
  
  // Don't show layout while loading or if not signed in
  if (!isLoaded || !isSignedIn) {
    return <>{children}</>;
  }
  
  return (
    <div className="min-h-screen flex">
      <RoleNavigation />
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
