import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import LoginPage from '../app/(auth)/login/page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/login',
}));

describe('Frontend Auth & Compliance Tests', () => {
  it('renders login page with Sentinel Vision title', () => {
    render(<LoginPage />);
    expect(screen.getByText('SENTINEL VISION AI')).toBeInTheDocument();
  });

  it('displays the mandatory human verification compliance notice', () => {
    render(<LoginPage />);
    expect(screen.getByText(/possible sightings/i)).toBeInTheDocument();
    expect(screen.getByText(/Never auto-confirm identity/i)).toBeInTheDocument();
  });
});
