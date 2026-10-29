import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { User } from '@/types';

interface UserState {
  users: User[];
  setUsers: (users: User[]) => void;
  updateRole: (userId: string, role: User['role']) => void;
}

export const useUserStore = create<UserState>()(
  devtools(
    (set) => ({
      users: [],
      setUsers: (users) => set({ users }),
      updateRole: (userId, role) =>
        set((state) => ({
          users: state.users.map((u) => (u.id === userId ? { ...u, role } : u)),
        })),
    }),
    { name: 'SentinelUserStore' },
  ),
);
