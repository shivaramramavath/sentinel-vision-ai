'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/ui.store';
import { useCounts } from '@/hooks/use-counts';
import {
  LayoutDashboard,
  Video,
  FolderOpen,
  Search,
  Eye,
  GitFork,
  FileCheck2,
  Bell,
  ChevronLeft,
  ChevronRight,
  UserCog,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUiStore();
  const { data: counts } = useCounts('global');

  const pendingReviewCount = counts?.pendingReviews ?? counts?.pendingReview ?? 0;
  const liveCamerasCount = counts?.liveCameras ?? 0;
  const unacknowledgedAlerts = counts?.alerts ?? counts?.unacknowledgedAlerts ?? 0;

  // Single Source of Truth Navigation Items
  const navItems = [
    { href: '/dashboard', label: 'Command Center', icon: LayoutDashboard },
    { href: '/cameras', label: 'Cameras', icon: Video, badge: `${liveCamerasCount} LIVE` },
    { href: '/cases', label: 'Cases', icon: FolderOpen },
    { href: '/search', label: 'Search', icon: Search },
    {
      href: '/review',
      label: 'Review',
      icon: Eye,
      badge: pendingReviewCount > 0 ? `${pendingReviewCount} Review` : undefined,
      badgeVariant: 'amber',
    },
    { href: '/journeys', label: 'Journeys', icon: GitFork },
    { href: '/evidence', label: 'Evidence & Reports', icon: FileCheck2 },
    {
      href: '/alerts',
      label: 'Alerts',
      icon: Bell,
      badge: unacknowledgedAlerts > 0 ? `${unacknowledgedAlerts} New` : undefined,
      badgeVariant: 'rose',
    },
    { href: '/admin/users', label: 'Administration', icon: UserCog },
  ];

  return (
    <aside
      className={cn(
        'group/sidebar relative flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out',
        sidebarCollapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        {!sidebarCollapsed && (
          <Link href="/dashboard" className="flex items-center gap-2 font-mono font-bold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-black">
              S
            </span>
            <span className="text-sm font-semibold tracking-wider">SENTINEL</span>
            <span className="text-[10px] font-mono text-muted-foreground ml-1">v2.1</span>
          </Link>
        )}
        {sidebarCollapsed && (
          <Link href="/dashboard" className="mx-auto flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-black">
            S
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={cn(
            'h-6 w-6 text-muted-foreground hover:text-foreground',
            sidebarCollapsed && 'hidden',
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                sidebarCollapsed && 'justify-center px-2',
              )}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              {!sidebarCollapsed && item.badge && (
                <Badge
                  variant="outline"
                  className={cn(
                    'ml-auto text-[10px] font-mono px-1.5 py-0 h-4 leading-none',
                    item.badgeVariant === 'amber' && 'border-amber-500/40 text-amber-500 bg-amber-500/10',
                    item.badgeVariant === 'rose' && 'border-rose-500/40 text-rose-500 bg-rose-500/10',
                  )}
                >
                  {item.badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Expand trigger when collapsed */}
      {sidebarCollapsed && (
        <div className="p-2 border-t flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </aside>
  );
}
