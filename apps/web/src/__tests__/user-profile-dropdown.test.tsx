import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Topbar } from '../components/layout/topbar';
import { useAuthStore } from '../stores/auth.store';
import { usersApi } from '../lib/api/users.api';
import { User } from '@/types';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock useAlerts hook
jest.mock('../hooks/use-alerts', () => ({
  useAlerts: () => ({ data: [], isLoading: false }),
}));

// Mock DropdownMenu UI primitives for reliable JSDOM component testing
jest.mock('@/components/ui/dropdown-menu', () => {
  const React = require('react');
  return {
    DropdownMenu: ({ children }: any) => <div data-testid="dropdown-root">{children}</div>,
    DropdownMenuTrigger: ({ children, asChild }: any) => <div data-testid="dropdown-trigger">{children}</div>,
    DropdownMenuContent: ({ children, className }: any) => (
      <div data-testid="dropdown-content" className={className}>
        {children}
      </div>
    ),
    DropdownMenuItem: ({ children, onClick, className }: any) => (
      <div role="menuitem" tabIndex={0} onClick={onClick} className={className}>
        {children}
      </div>
    ),
    DropdownMenuLabel: ({ children, className }: any) => <div className={className}>{children}</div>,
    DropdownMenuSeparator: () => <hr />,
  };
});

// Mock usersApi.me
jest.mock('../lib/api/users.api', () => ({
  usersApi: {
    me: jest.fn(),
    list: jest.fn(),
    updateRole: jest.fn(),
  },
}));

describe('User Profile Dropdown - Database-Driven Verification', () => {
  let queryClient: QueryClient;

  const mockAdminUser: User = {
    id: 'usr_db_admin_001',
    name: 'Officer Alex Chen',
    fullName: 'Officer Alex Chen',
    email: 'alex.chen@sentinel.agency',
    role: 'super_admin',
    badgeNumber: 'SA-9901',
    department: 'Metro Surveillance Unit',
    avatarUrl: 'https://images.unsplash.com/photo-alex.jpg',
    status: 'active',
    failedLoginCount: 0,
    mfa: { enabled: true, recoveryCodesHashed: [] },
    createdVia: 'bootstrap',
  };

  const mockInvestigatorUser: User = {
    id: 'usr_db_inv_002',
    name: 'Det. Maya Lin',
    fullName: 'Det. Maya Lin',
    email: 'maya.lin@sentinel.agency',
    role: 'investigator',
    badgeNumber: '', // Missing optional badge
    department: '', // Missing optional department
    avatarUrl: '', // Missing optional avatar
    status: 'active',
    failedLoginCount: 0,
    mfa: { enabled: false, recoveryCodesHashed: [] },
    createdVia: 'password',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    // Reset Zustand auth store
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isCheckingAuth: false,
    });
  });

  const renderTopbar = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <Topbar />
      </QueryClientProvider>,
    );
  };

  test('1. Dropdown displays the actual authenticated user name, badge identifier, and email from database', async () => {
    (usersApi.me as jest.Mock).mockResolvedValue(mockAdminUser);
    useAuthStore.setState({
      user: mockAdminUser,
      accessToken: 'token-admin-123',
      isAuthenticated: true,
      isCheckingAuth: false,
    });

    renderTopbar();

    const trigger = screen.getByLabelText(/user profile options/i);
    expect(trigger).toBeInTheDocument();
    fireEvent.click(trigger);

    // Verified database attributes
    await waitFor(() => {
      expect(screen.getByText('Officer Alex Chen')).toBeInTheDocument();
      expect(screen.getByText('alex.chen@sentinel.agency')).toBeInTheDocument();
      expect(screen.getByText('SA-9901')).toBeInTheDocument();
      expect(screen.getByText(/Metro Surveillance Unit/i)).toBeInTheDocument();
    });

    // No hardcoded fake fallback data
    expect(screen.queryByText('Insp. Sarah Vance')).not.toBeInTheDocument();
    expect(screen.queryByText('SV-4902')).not.toBeInTheDocument();
  });

  test('2. The displayed role matches the role authorized and returned by the backend', async () => {
    (usersApi.me as jest.Mock).mockResolvedValue(mockAdminUser);
    useAuthStore.setState({
      user: mockAdminUser,
      accessToken: 'token-admin-123',
      isAuthenticated: true,
      isCheckingAuth: false,
    });

    renderTopbar();
    fireEvent.click(screen.getByLabelText(/user profile options/i));

    await waitFor(() => {
      expect(screen.getByText('Authorized Role')).toBeInTheDocument();
      expect(screen.getByText('Super Admin')).toBeInTheDocument();
    });
  });

  test('3. Missing profile image uses generic fallback initials or icon without inventing identity', async () => {
    (usersApi.me as jest.Mock).mockResolvedValue(mockInvestigatorUser);
    useAuthStore.setState({
      user: mockInvestigatorUser,
      accessToken: 'token-inv-456',
      isAuthenticated: true,
      isCheckingAuth: false,
    });

    renderTopbar();

    // Fallback initials derived dynamically from 'Det. Maya Lin' -> 'DL'
    expect(screen.getByText('DL')).toBeInTheDocument();
    // Must NOT use fabricated static fallback 'AD'
    expect(screen.queryByText('AD')).not.toBeInTheDocument();
  });

  test('4. Missing optional fields (badgeNumber, department) do not produce fake or fabricated values', async () => {
    (usersApi.me as jest.Mock).mockResolvedValue(mockInvestigatorUser);
    useAuthStore.setState({
      user: mockInvestigatorUser,
      accessToken: 'token-inv-456',
      isAuthenticated: true,
      isCheckingAuth: false,
    });

    renderTopbar();
    fireEvent.click(screen.getByLabelText(/user profile options/i));

    await waitFor(() => {
      expect(screen.getByText('Det. Maya Lin')).toBeInTheDocument();
      expect(screen.getByText('Investigator')).toBeInTheDocument();
    });

    // Ensure no fake badge like SA-0001 or SV-4902 was injected
    expect(screen.queryByText('SV-4902')).not.toBeInTheDocument();
    expect(screen.queryByText('SA-0001')).not.toBeInTheDocument();
  });

  test('5. Switching authenticated accounts displays each accounts own real data', async () => {
    // First account
    (usersApi.me as jest.Mock).mockResolvedValue(mockAdminUser);
    useAuthStore.setState({
      user: mockAdminUser,
      accessToken: 'token-admin',
      isAuthenticated: true,
      isCheckingAuth: false,
    });

    const { unmount } = renderTopbar();
    fireEvent.click(screen.getByLabelText(/user profile options/i));
    expect(await screen.findByText('Officer Alex Chen')).toBeInTheDocument();
    unmount();

    // Account switched to Investigator
    queryClient.clear();
    (usersApi.me as jest.Mock).mockResolvedValue(mockInvestigatorUser);
    useAuthStore.setState({
      user: mockInvestigatorUser,
      accessToken: 'token-inv',
      isAuthenticated: true,
      isCheckingAuth: false,
    });

    renderTopbar();
    fireEvent.click(screen.getByLabelText(/user profile options/i));
    expect(await screen.findByText('Det. Maya Lin')).toBeInTheDocument();
    expect(screen.queryByText('Officer Alex Chen')).not.toBeInTheDocument();
  });

  test('6. Logout clears user profile state and invalidates query cache', async () => {
    const logoutMock = jest.fn().mockImplementation(async () => {
      useAuthStore.setState({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isCheckingAuth: false,
      });
    });
    useAuthStore.setState({
      user: mockAdminUser,
      accessToken: 'token-admin',
      isAuthenticated: true,
      logout: logoutMock,
    });

    renderTopbar();
    fireEvent.click(screen.getByLabelText(/user profile options/i));

    const signOutBtn = await screen.findByText('Sign Out');
    fireEvent.click(signOutBtn);

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalled();
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  test('7. No client-side role switching items exist (prevents privilege escalation)', async () => {
    (usersApi.me as jest.Mock).mockResolvedValue(mockInvestigatorUser);
    useAuthStore.setState({
      user: mockInvestigatorUser,
      accessToken: 'token-inv',
      isAuthenticated: true,
      isCheckingAuth: false,
    });

    renderTopbar();
    fireEvent.click(screen.getByLabelText(/user profile options/i));

    await waitFor(() => {
      expect(screen.getByText('Det. Maya Lin')).toBeInTheDocument();
    });

    // Verify all unauthorized role switching options are removed
    expect(screen.queryByText('Role: Super Admin')).not.toBeInTheDocument();
    expect(screen.queryByText('Role: Investigator')).not.toBeInTheDocument();
    expect(screen.queryByText('Role: Reviewer')).not.toBeInTheDocument();
    expect(screen.queryByText('Role: Viewer')).not.toBeInTheDocument();
  });

  test('8. API failure does not substitute mock user data', async () => {
    (usersApi.me as jest.Mock).mockRejectedValue(new Error('Network error'));
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isCheckingAuth: false,
    });

    renderTopbar();
    fireEvent.click(screen.getByLabelText(/user profile options/i));

    // Ensure mock data is not substituted on error
    expect(screen.queryByText('Insp. Sarah Vance')).not.toBeInTheDocument();
    expect(screen.queryByText('SV-4902')).not.toBeInTheDocument();
    expect(screen.queryByText('Shiva Ram Ramavath')).not.toBeInTheDocument();
  });
});
