import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { usersListQueryOptions, currentUserQueryOptions } from '@/lib/query/options';
import { usersApi } from '@/lib/api/users.api';
import { keys } from '@/lib/query/keys';
import { useAuthStore } from '@/stores/auth.store';

export function useUsers() {
  return useQuery(usersListQueryOptions());
}

export function useCurrentUser() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const query = useQuery({
    ...currentUserQueryOptions(),
    enabled: isAuthenticated,
    initialData: authUser || undefined,
  });

  // Keep auth store synced with the freshest DB record returned by TanStack Query
  React.useEffect(() => {
    if (query.data && JSON.stringify(query.data) !== JSON.stringify(authUser)) {
      setUser(query.data);
    }
  }, [query.data, authUser, setUser]);

  return query;
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      usersApi.updateRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.users.all });
    },
  });
}
