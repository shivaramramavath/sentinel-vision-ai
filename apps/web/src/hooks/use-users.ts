import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersListQueryOptions } from '@/lib/query/options';
import { usersApi } from '@/lib/api/users.api';
import { keys } from '@/lib/query/keys';

export function useUsers() {
  return useQuery(usersListQueryOptions());
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
