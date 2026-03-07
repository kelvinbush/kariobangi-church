"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useState } from "react";

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
    secondaryRole?: string;
  } | undefined;
  
  const roles = new Set<string>();
  
  if (metadata?.role) roles.add(metadata.role);
  if (metadata?.roles?.length) {
    metadata.roles.forEach((r: string) => roles.add(r));
  }
  if (metadata?.secondaryRole) roles.add(metadata.secondaryRole);
  
  return Array.from(roles);
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
}

export default function RoleNavigation() {
  const { user } = useUser();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const userRoles = getUserRoles(user);
  const isAdmin = userRoles.includes("admin");
  
  // Define all navigation items with their required roles
  const allNavItems: NavItem[] = [
    // Admin/Home
    {
      href: "/",
      label: "Dashboard",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path d="M9 22V12h6v10" />
        </svg>
      ),
      roles: ["admin"],
    },
    // Protocol team routes
    {
      href: "/attendance",
      label: "Attendance",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      roles: ["protocol", "follow-up-admin", "admin"],
    },
    {
      href: "/visitors",
      label: "Visitors",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      roles: ["protocol", "follow-up-admin", "admin"],
    },
    {
      href: "/master-list",
      label: "Members",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
      roles: ["protocol", "follow-up-admin", "admin"],
    },
    // Follow-ups
    {
      href: "/follow-ups",
      label: "Follow-ups",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      roles: ["follow-up-admin", "admin"],
    },
    {
      href: "/follow-ups/my",
      label: "My Follow-ups",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      roles: ["protocol", "follow-up-admin", "admin"],
    },
    // Cluster routes
    {
      href: "/cluster-head",
      label: "My Cluster",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      roles: ["cluster-head"],
    },
    {
      href: "/cluster-admin",
      label: "Clusters",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      roles: ["cluster-admin", "admin", "fellowship-pastor"],
    },
    {
      href: "/cluster-admin/heads",
      label: "Cluster Heads",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      roles: ["cluster-admin", "admin", "fellowship-pastor"],
    },
    // Fellowship Pastor
    {
      href: "/fellowship-pastor",
      label: "Pastor",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 14l9-5-9-5-9 5 9 5z" />
          <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        </svg>
      ),
      roles: ["fellowship-pastor"],
    },
    // Worship Pastor
    {
      href: "/worship-pastor",
      label: "Worship",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      ),
      roles: ["worship-pastor"],
    },
    // Demographics (for fellowship-pastor and admin)
    {
      href: "/youth/men",
      label: "Youth Men",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      roles: ["fellowship-pastor", "admin", "cluster-admin"],
    },
    {
      href: "/youth/ladies",
      label: "Youth Ladies",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 14l9-5-9-5-9 5 9 5z" />
          <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        </svg>
      ),
      roles: ["fellowship-pastor", "admin", "cluster-admin"],
    },
    {
      href: "/married/men",
      label: "Married Men",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      roles: ["fellowship-pastor", "admin", "cluster-admin"],
    },
    {
      href: "/married/women",
      label: "Married Women",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
      roles: ["fellowship-pastor", "admin", "cluster-admin"],
    },
  ];
  
  // Filter nav items based on user roles
  // If user has multiple roles, show all relevant navigation
  const navItems = allNavItems.filter(item => 
    isAdmin || item.roles.some(role => userRoles.includes(role))
  );
  
  // Don't show nav if no items
  if (navItems.length === 0) return null;
  
  // Group items by category for better organization
  const protocolItems = navItems.filter(i => 
    ["/attendance", "/visitors", "/master-list", "/follow-ups/my"].includes(i.href)
  );
  const clusterItems = navItems.filter(i => 
    i.href.includes("cluster")
  );
  const pastorItems = navItems.filter(i => 
    i.href.includes("fellowship") || i.href.includes("youth") || i.href.includes("married")
  );
  const worshipItems = navItems.filter(i => 
    i.href.includes("worship-pastor")
  );
  const adminItems = navItems.filter(i => 
    i.href === "/" || i.href === "/follow-ups"
  );
  
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  
  return (
    <>
      {/* Mobile Bottom Navigation */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-50 border-t sm:hidden"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.slice(0, 5).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 px-2 py-1 rounded-lg"
              style={{ 
                color: isActive(item.href) ? theme.accent : theme.text.muted,
              }}
            >
              {item.icon}
              <span className="text-[10px]">{item.label.split(" ")[0]}</span>
            </Link>
          ))}
          {navItems.length > 5 && (
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center gap-1 px-2 py-1 rounded-lg"
              style={{ color: theme.text.muted }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="text-[10px]">More</span>
            </button>
          )}
        </div>
      </nav>
      
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-50 sm:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="absolute bottom-20 left-4 right-4 rounded-2xl overflow-hidden max-h-[70vh] flex flex-col"
            style={{ backgroundColor: theme.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium" style={{ color: theme.text.primary }}>
                  Navigation
                </span>
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ color: theme.text.muted }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Grouped navigation */}
              {protocolItems.length > 0 && (
                <div className="mb-4">
                  <span className="text-xs uppercase tracking-wide mb-2 block" style={{ color: theme.text.muted }}>
                    Protocol
                  </span>
                  <div className="space-y-1">
                    {protocolItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl"
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
              )}
              
              {clusterItems.length > 0 && (
                <div className="mb-4">
                  <span className="text-xs uppercase tracking-wide mb-2 block" style={{ color: theme.text.muted }}>
                    Cluster
                  </span>
                  <div className="space-y-1">
                    {clusterItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl"
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
              )}
              
              {pastorItems.length > 0 && (
                <div className="mb-4">
                  <span className="text-xs uppercase tracking-wide mb-2 block" style={{ color: theme.text.muted }}>
                    Fellowship
                  </span>
                  <div className="space-y-1">
                    {pastorItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl"
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
              )}

              {worshipItems.length > 0 && (
                <div className="mb-4">
                  <span className="text-xs uppercase tracking-wide mb-2 block" style={{ color: theme.text.muted }}>
                    Worship
                  </span>
                  <div className="space-y-1">
                    {worshipItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl"
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
              )}
              
              {adminItems.length > 0 && (
                <div>
                  <span className="text-xs uppercase tracking-wide mb-2 block" style={{ color: theme.text.muted }}>
                    Admin
                  </span>
                  <div className="space-y-1">
                    {adminItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl"
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
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Desktop Sidebar Navigation */}
      <nav 
        className="hidden sm:flex fixed left-0 top-0 bottom-0 w-64 flex-col border-r z-40"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <div className="p-4 border-b" style={{ borderColor: theme.border }}>
          <span className="text-lg font-medium" style={{ color: theme.text.primary }}>
            Imaara
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {/* Grouped navigation */}
          {protocolItems.length > 0 && (
            <div className="mb-6">
              <span className="text-xs uppercase tracking-wide mb-2 block" style={{ color: theme.text.muted }}>
                Protocol Team
              </span>
              <div className="space-y-1">
                {protocolItems.map((item) => (
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
          )}
          
          {adminItems.length > 0 && (
            <div className="mb-6">
              <span className="text-xs uppercase tracking-wide mb-2 block" style={{ color: theme.text.muted }}>
                Admin
              </span>
              <div className="space-y-1">
                {adminItems.map((item) => (
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
          )}
          
          {clusterItems.length > 0 && (
            <div className="mb-6">
              <span className="text-xs uppercase tracking-wide mb-2 block" style={{ color: theme.text.muted }}>
                Cluster
              </span>
              <div className="space-y-1">
                {clusterItems.map((item) => (
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
          )}
          
          {pastorItems.length > 0 && (
            <div className="mb-6">
              <span className="text-xs uppercase tracking-wide mb-2 block" style={{ color: theme.text.muted }}>
                Fellowship Pastor
              </span>
              <div className="space-y-1">
                {pastorItems.map((item) => (
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
          )}

          {worshipItems.length > 0 && (
            <div className="mb-6">
              <span className="text-xs uppercase tracking-wide mb-2 block" style={{ color: theme.text.muted }}>
                Worship Pastor
              </span>
              <div className="space-y-1">
                {worshipItems.map((item) => (
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
          )}
        </div>
      </nav>
      
      {/* Spacer for desktop */}
      <div className="hidden sm:block w-64 flex-shrink-0" />
      
      {/* Mobile spacer for bottom nav */}
      <div className="sm:hidden h-16" />
    </>
  );
}
