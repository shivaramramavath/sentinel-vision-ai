'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useUserStore } from '@/stores/user.store';
import { UserRole } from '@/types';
import { MobileIngestionPanel } from '@/components/features/cameras/MobileIngestionPanel';
import { UserCog, Shield, KeyRound, Plus, Smartphone, Users } from 'lucide-react';

function UsersContent() {
  const { users, updateRole } = useUserStore();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'mobile' ? 'mobile' : 'internal';
  const [selectedTab, setSelectedTab] = useState(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'mobile') {
      setSelectedTab('mobile');
    }
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Identity & Access Management</h1>
          <p className="text-xs text-muted-foreground">
            Enforce separation of duties for internal investigators, command staff, and field mobile operators.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {selectedTab === 'internal' ? (
            <Button size="sm" className="h-8 gap-1.5 font-medium" onClick={() => alert('New user invitation modal...')}>
              <Plus className="h-4 w-4" /> Provision Investigator
            </Button>
          ) : (
            <Link href="/m/register" target="_blank">
              <Button size="sm" variant="outline" className="h-8 gap-1.5 font-mono text-xs">
                <Smartphone className="h-3.5 w-3.5" /> Mobile Portal
              </Button>
            </Link>
          )}
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="bg-muted/60 p-1">
          <TabsTrigger value="internal" className="gap-2 text-xs">
            <Users className="h-3.5 w-3.5" />
            Internal Investigators (RBAC)
          </TabsTrigger>
          <TabsTrigger value="mobile" className="gap-2 text-xs">
            <Smartphone className="h-3.5 w-3.5 text-cyan-400" />
            Mobile Field Operators
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Internal RBAC */}
        <TabsContent value="internal" className="space-y-4 m-0">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 font-mono text-[11px] text-muted-foreground text-left">
                    <th className="p-3 font-medium">INVESTIGATOR / OPERATOR</th>
                    <th className="p-3 font-medium">BADGE #</th>
                    <th className="p-3 font-medium">DEPARTMENT</th>
                    <th className="p-3 font-medium">ACCESS ROLE (RBAC)</th>
                    <th className="p-3 font-medium text-right">CHANGE ROLE</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={u.avatarUrl} alt={u.name} />
                          <AvatarFallback>{u.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-xs leading-none">{u.name}</div>
                          <div className="text-[10px] text-muted-foreground pt-1">{u.email}</div>
                        </div>
                      </td>

                      <td className="p-3 font-mono text-muted-foreground">
                        {u.badgeNumber}
                      </td>

                      <td className="p-3 text-muted-foreground">
                        {u.department}
                      </td>

                      <td className="p-3">
                        <Badge
                          variant={u.role === 'admin' ? 'default' : u.role === 'operator' ? 'secondary' : 'outline'}
                          className="font-mono text-[10px] uppercase font-bold"
                        >
                          {u.role}
                        </Badge>
                      </td>

                      <td className="p-3 text-right">
                        <Select
                          value={u.role}
                          onValueChange={(newRole: UserRole) => updateRole(u.id, newRole)}
                        >
                          <SelectTrigger className="w-[130px] h-7 text-xs ml-auto">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="operator">Operator</SelectItem>
                            <SelectItem value="analyst">Analyst</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Mobile Field Operators */}
        <TabsContent value="mobile" className="space-y-4 m-0">
          <MobileIngestionPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-muted-foreground">Loading identity management...</div>}>
      <UsersContent />
    </Suspense>
  );
}
