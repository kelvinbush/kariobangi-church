"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";

// Clean color palette
const theme = {
  bg: '#f9f8f6',
  surface: '#ffffff',
  border: '#e8e6e3',
  accent: '#7c6f5a',
  text: {
    primary: '#1a1a1a',
    secondary: '#5a5a5a',
    muted: '#9a9997',
  },
};

// Helper to get all user roles
function getUserRoles(user: any): string[] {
  const metadata = user?.publicMetadata as {
    role?: string;
    roles?: string[];
  } | undefined;

  const roles = new Set<string>();

  if (metadata?.role) roles.add(metadata.role);
  if (metadata?.roles?.length) {
    metadata.roles.forEach((r: string) => roles.add(r));
  }

  return Array.from(roles);
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

export default function RoleNavigation() {
  const { user } = useUser();
  const pathname = usePathname();

  const userRoles = getUserRoles(user);
  const isAdmin = userRoles.includes("admin");
  const isProtocol = isAdmin || userRoles.includes("protocol");

  // No nav for users without protocol/admin access
  if (!isProtocol) return null;

  const allNavItems: NavItem[] = [
    {
      href: "/",
      label: "Dashboard",
      adminOnly: true,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path d="M9 22V12h6v10" />
        </svg>
      ),
    },
    {
      href: "/attendance",
      label: "Attendance",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      href: "/visitors",
      label: "Visitors",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      href: "/members/import",
      label: "Members",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
    },
    {
      href: "/kids/import",
      label: "Kids",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="7" r="3" />
          <path d="M6 21v-2a6 6 0 0112 0v2" />
        </svg>
      ),
    },
  ];

  const navItems = allNavItems.filter((item) => isAdmin || !item.adminOnly);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t sm:hidden"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 px-2 py-1 rounded-lg"
              style={{ color: isActive(item.href) ? theme.accent : theme.text.muted }}
            >
              {item.icon}
              <span className="text-[10px]">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Desktop Sidebar Navigation */}
      <nav
        className="hidden sm:flex fixed left-0 top-0 bottom-0 w-64 flex-col border-r z-40"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <div className="p-4 border-b" style={{ borderColor: theme.border }}>
          <span className="text-lg font-medium" style={{ color: theme.text.primary }}>
            Kariobangi
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <span className="text-xs uppercase tracking-wide mb-2 block" style={{ color: theme.text.muted }}>
            Protocol Team
          </span>
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors"
                style={{
                  backgroundColor: isActive(item.href) ? `${theme.accent}15` : 'transparent',
                  color: isActive(item.href) ? theme.accent : theme.text.primary,
                }}
              >
                {item.icon}
                <span className="text-sm">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Spacer for desktop */}
      <div className="hidden sm:block w-64 flex-shrink-0" />

      {/* Mobile spacer for bottom nav */}
      <div className="sm:hidden h-16" />
    </>
  );
}
