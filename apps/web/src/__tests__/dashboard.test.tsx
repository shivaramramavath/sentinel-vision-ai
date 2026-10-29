import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from '../app/(app)/dashboard/page';
import { DashboardKpiStrip } from '../components/features/dashboard/DashboardKpiStrip';
import { SituationRoom } from '../components/features/dashboard/SituationRoom';
import { ActionQueueWidget } from '../components/features/dashboard/ActionQueueWidget';
import { SuggestedActionsWidget } from '../components/features/dashboard/SuggestedActionsWidget';
import { LiveSearchesWidget } from '../components/features/dashboard/LiveSearchesWidget';
import { ActivityFeedWidget } from '../components/features/dashboard/ActivityFeedWidget';
import { TeamOnCallWidget } from '../components/features/dashboard/TeamOnCallWidget';

// Mock Next.js dynamic imports
jest.mock('next/dynamic', () => () => {
  const DynamicComponent = () => (
    <div data-testid="mock-dynamic-component" />
  );
  DynamicComponent.displayName = 'DynamicComponent';
  return DynamicComponent;
});

// Mock next/navigation
const mockSearchParams = new URLSearchParams('site=all&range=24h');
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => mockSearchParams,
}));

// Mock MapLibre GL and useMap
jest.mock('../components/ui/map', () => ({
  useMap: () => ({
    map: {
      flyTo: jest.fn(),
      fitBounds: jest.fn(),
      getSource: jest.fn(),
      getLayer: jest.fn(),
      addSource: jest.fn(),
      addLayer: jest.fn(),
    },
    isLoaded: true,
  }),
  MapMarker: ({ children }: any) => <div data-testid="map-marker">{children}</div>,
  MarkerContent: ({ children }: any) => <div>{children}</div>,
  MarkerPopup: ({ children }: any) => <div>{children}</div>,
  MarkerTooltip: ({ children }: any) => <div>{children}</div>,
  MapRoute: () => <div data-testid="map-route" />,
  MapGeoJSON: () => <div data-testid="map-geojson" />,
}));

// Mock SentinelMap
jest.mock('../components/features/map', () => ({
  SentinelMap: ({ children }: any) => <div data-testid="sentinel-map">{children}</div>,
  CameraLayer: () => <div data-testid="camera-layer" />,
}));

// Mock socket
jest.mock('../lib/socket', () => ({
  socket: {
    on: jest.fn(),
    off: jest.fn(),
  },
  realtimeClient: {
    on: jest.fn(),
    off: jest.fn(),
  },
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Command Center Redesign & Widgets', () => {
  it('renders page header with title, site filter, time range, and quick action buttons', () => {
    renderWithClient(<DashboardPage />);

    expect(screen.getByRole('heading', { name: /command center/i })).toBeInTheDocument();
    expect(screen.getByText(/operational situation room/i)).toBeInTheDocument();

    // Quick action buttons
    expect(screen.getByText(/start ai search/i)).toBeInTheDocument();
    expect(screen.getByText(/register missing person/i)).toBeInTheDocument();
  });

  it('renders the 5 KPI cards in the KPI strip', async () => {
    renderWithClient(<DashboardKpiStrip />);

    // Check KPI cards render
    expect(await screen.findByText(/active cases/i)).toBeInTheDocument();
    expect(screen.getByText(/awaiting review/i)).toBeInTheDocument();
    expect(screen.getByText(/searches running/i)).toBeInTheDocument();
    expect(screen.getByText(/same-person \(7d\)/i)).toBeInTheDocument();
    expect(screen.getByText(/turnaround time/i)).toBeInTheDocument();
  });

  it('renders the Situation Room with priority cases rail', async () => {
    renderWithClient(<SituationRoom />);

    expect(await screen.findByText(/priority cases/i)).toBeInTheDocument();
    expect(screen.getAllByText(/maya lin/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/missing/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the Action Queue with urgency filter tabs and quick actions', async () => {
    renderWithClient(<ActionQueueWidget />);

    expect(await screen.findByText(/action queue/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /reviews/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /escalations/i })).toBeInTheDocument();
  });

  it('renders Suggested Actions & Coverage Gaps with explainable reasons', async () => {
    renderWithClient(<SuggestedActionsWidget />);

    expect(await screen.findByText(/suggested actions & gaps/i)).toBeInTheDocument();
  });

  it('renders Live AI Searches with active scanning progress', async () => {
    renderWithClient(<LiveSearchesWidget />);

    expect(await screen.findByText(/live ai searches/i)).toBeInTheDocument();
  });

  it('renders Multi-Case Activity Feed with filter chips', async () => {
    renderWithClient(<ActivityFeedWidget />);

    expect(await screen.findByText(/multi-case activity feed/i)).toBeInTheDocument();
  });

  it('renders Team & On-Call widget with active duty shift info', async () => {
    renderWithClient(<TeamOnCallWidget />);

    expect(await screen.findByText(/team & on-call/i)).toBeInTheDocument();
    expect(screen.getByText(/shift active/i)).toBeInTheDocument();
  });
});
