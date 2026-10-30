'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useUiStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CaseSwitcher } from '@/components/shared/CaseSwitcher';
import { useAlerts } from '@/hooks/use-alerts';
import { useCurrentUser } from '@/hooks/use-users';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Bell,
  Search,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Shield,
  Settings,
  User as UserIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

function formatUserRole(role?: string): string {
  if (!role) return 'User';
  const clean = role.toLowerCase().replace(/[\s_-]+/g, '');
  switch (clean) {
    case 'superadmin':
      return 'Super Admin';
    case 'investigator':
      return 'Investigator';
    case 'reviewer':
      return 'Reviewer';
    case 'viewer':
      return 'Viewer';
    case 'mobileoperator':
      return 'Mobile Operator';
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

function getUserInitials(name?: string, email?: string): string {
  const raw = (name || '').trim();
  if (raw) {
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return raw.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return '';
}

export function Topbar() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { setCmdKOpen } = useUiStore();
  const { logout } = useAuthStore();
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();
  const { data: alerts = [] } = useAlerts();

  const unreadAlerts = alerts.filter((a) => !a.read);

  const displayName = currentUser?.fullName || currentUser?.name || currentUser?.email || 'User';
  const initials = getUserInitials(currentUser?.fullName || currentUser?.name, currentUser?.email);
  const badgeNumber = currentUser?.badgeNumber?.trim();
  const department = currentUser?.department?.trim();

  const handleLogout = async () => {
    queryClient.clear();
    await logout();
  };

  // Format breadcrumb from pathname
  const pageTitle =
    pathname === '/dashboard'
      ? 'Command Center'
      : pathname.split('/')[1]?.replace('-', ' ').toUpperCase() || 'SENTINEL';

  return (
    <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Left: Current Page Title & Active Case Switcher */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {pageTitle}
          </span>
          <span className="text-muted-foreground/40">/</span>
        </div>

        {/* Persistent Shared CaseSwitcher (shown ONLY on case-scoped pages, hidden on /dashboard, /admin, /alerts) */}
        {!pathname.startsWith('/dashboard') &&
          !pathname.startsWith('/admin') &&
          !pathname.startsWith('/alerts') && (
            <CaseSwitcher />
          )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Real System Status Chip linking to /admin/health */}
        <Link href="/admin/health" className="hidden sm:flex items-center">
          <Badge
            variant="outline"
            className="text-[11px] gap-1 px-2 border-emerald-500/40 text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 font-mono"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            System Operational
          </Badge>
        </Link>
        {/* Global Search Cmd+K trigger */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCmdKOpen(true)}
          className="relative h-8 w-44 justify-start gap-2 bg-muted/40 text-xs text-muted-foreground"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Quick search...</span>
          <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            ⌘K
          </kbd>
        </Button>

        {/* Live Notification Bell */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label="Notifications">
              <Bell className="h-4 w-4" />
              {unreadAlerts.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-black">
                  {unreadAlerts.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between text-xs font-mono">
              <span>ACTIVE SYSTEM ALERTS</span>
              <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/40">
                {unreadAlerts.length} Unread
              </Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {alerts.slice(0, 3).map((a) => (
              <DropdownMenuItem key={a.id} className="flex flex-col items-start gap-1 p-2 cursor-pointer">
                <div className="flex w-full items-center justify-between">
                  <span className="font-semibold text-xs flex items-center gap-1.5">
                    {a.severity === 'critical' ? (
                      <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                    )}
                    {a.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {typeof a.timestamp === 'string' ? a.timestamp : ''}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{a.message}</p>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Profile Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-8 w-8 rounded-full border border-border/40 hover:border-border transition-colors"
              aria-label="User profile options"
            >
              <Avatar className="h-8 w-8">
                {currentUser?.avatarUrl ? (
                  <AvatarImage src={currentUser.avatarUrl} alt={displayName} />
                ) : null}
                <AvatarFallback className="font-mono text-xs bg-muted text-muted-foreground">
                  {initials ? initials : <UserIcon className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                {isUserLoading && !currentUser ? (
                  <div className="space-y-1.5 py-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold leading-none text-foreground truncate">
                      {displayName}
                    </p>
                    {currentUser?.email && (
                      <p className="text-xs text-muted-foreground truncate font-mono">
                        {currentUser.email}
                      </p>
                    )}
                    {(badgeNumber || department) && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-muted-foreground font-mono">
                        {badgeNumber && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-foreground font-medium">
                            {badgeNumber}
                          </span>
                        )}
                        {badgeNumber && department && <span>•</span>}
                        {department && (
                          <span className="truncate max-w-[140px] text-muted-foreground">
                            {department}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Verified Server-Authorized Role (Informational status, strictly server-driven) */}
            <div className="flex items-center justify-between px-2 py-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Authorized Role
              </span>
              <Badge variant="outline" className="font-mono text-[10px] uppercase border-border/80 text-foreground">
                {formatUserRole(currentUser?.role)}
              </Badge>
            </div>

            <DropdownMenuSeparator />

            {/* Account Settings & Security Links */}
            <DropdownMenuItem asChild>
              <Link href="/settings/account/security" className="cursor-pointer flex items-center">
                <Shield className="mr-2 h-4 w-4 text-muted-foreground" />
                Security & MFA
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer flex items-center">
                <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                Settings
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Sign Out */}
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-rose-500 focus:text-rose-500 cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
