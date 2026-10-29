import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  useDbStore,
  selectTotalCamerasCount,
  selectLiveCamerasCount,
  selectDegradedCamerasCount,
  selectOfflineCamerasCount,
  selectUnplacedCameras,
  selectSites,
  selectTopologyTransitions,
  selectTopologyVersion,
  deriveCameraStatus,
  INITIAL_CAMERAS,
} from './fixtures/test-db';
import { CameraDetailPanel } from '@/components/features/cameras/CameraDetailPanel';
import { TopologyEditBanner } from '@/components/features/cameras/TopologyEditBanner';
import { UnplacedCamerasTray } from '@/components/features/cameras/UnplacedCamerasTray';
import { LassoActionBar } from '@/components/features/cameras/LassoActionBar';
import { Camera } from '@/types';

// Mock child components that rely on WebRTC, HLS, or MapLibre canvas
jest.mock('@/components/features/cameras/CameraPlayer', () => ({
  CameraPlayer: ({ cameraId, name }: { cameraId: string; name?: string }) => (
    <div data-testid="mock-camera-player" data-camera-id={cameraId}>
      {name}
    </div>
  ),
}));

// Mock React Query hooks to delegate to test store
jest.mock('@/hooks/use-cameras', () => ({
  useCameras: () => ({ data: useDbStore.getState().cameras, isLoading: false }),
  useCameraTopology: () => ({ data: useDbStore.getState().cameraTopology, isLoading: false }),
  useUpdateCamera: () => ({ mutate: jest.fn(), mutateAsync: jest.fn() }),
  useUpdateTransition: () => ({ mutate: jest.fn(), mutateAsync: jest.fn() }),
}));

jest.mock('@/hooks/use-sightings', () => ({
  useSightings: () => ({ data: [], isLoading: false }),
}));

describe('Consolidated Cameras & Spatial Topology (/cameras)', () => {
  beforeEach(() => {
    // Reset store
    useDbStore.setState({
      cameras: INITIAL_CAMERAS,
      cameraTopology: useDbStore.getState().cameraTopology,
      topologyVersion: 1,
      auditTrail: [],
    });
  });

  describe('1. Single Source of Truth & Derived Health Status', () => {
    test('1.1 Status is strictly derived from health telemetry', () => {
      // 1. Live: fresh frame within 10s, fps >= 15, packetLoss < 5%, latency < 300ms
      const liveStatus = deriveCameraStatus({
        lastFrameAt: new Date(Date.now() - 1000).toISOString(),
        fps: 30,
        bitrate: 4096,
        packetLoss: 0.1,
        latencyMs: 38,
      });
      expect(liveStatus).toBe('live');

      // 2. Degraded: frames arriving but packet loss >= 5% or fps < 15 or latency > 300ms
      const degradedStatus1 = deriveCameraStatus({
        lastFrameAt: new Date(Date.now() - 2000).toISOString(),
        fps: 12, // < 15
        bitrate: 1200,
        packetLoss: 1.0,
        latencyMs: 45,
      });
      expect(degradedStatus1).toBe('degraded');

      const degradedStatus2 = deriveCameraStatus({
        lastFrameAt: new Date(Date.now() - 2000).toISOString(),
        fps: 30,
        bitrate: 4096,
        packetLoss: 7.2, // >= 5%
        latencyMs: 45,
      });
      expect(degradedStatus2).toBe('degraded');

      // 3. Offline: no frames for > 10s or fps === 0
      const offlineStatus = deriveCameraStatus({
        lastFrameAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
        fps: 0,
        bitrate: 0,
        packetLoss: 100,
        latencyMs: 0,
      });
      expect(offlineStatus).toBe('offline');

      // 4. Admin Disabled
      const disabledStatus = deriveCameraStatus(undefined, true);
      expect(disabledStatus).toBe('disabled');
    });

    test('1.2 Fleet counts exactly match the specification', () => {
      const state = useDbStore.getState();

      const total = selectTotalCamerasCount(state);
      const live = selectLiveCamerasCount(state);
      const degraded = selectDegradedCamerasCount(state);
      const offline = selectOfflineCamerasCount(state);
      const sites = selectSites(state);
      const unplaced = selectUnplacedCameras(state);

      expect(total).toBe(124);
      expect(live).toBe(110);
      expect(degraded).toBe(6);
      expect(offline).toBe(8);
      expect(sites.length).toBe(8);
      expect(unplaced.length).toBe(7);
      expect(live + degraded + offline).toBe(total);
    });
  });

  describe('2. Topology & Geo Placement Mutators', () => {
    test('2.1 Placing an unplaced camera sets coordinates and logs to audit trail', () => {
      const state = useDbStore.getState();
      const unplaced = selectUnplacedCameras(state);
      expect(unplaced.length).toBe(7);

      const targetCam = unplaced[0];
      useDbStore.getState().placeCamera(targetCam.id, [40.7128, -74.006], 90, 75);

      const updated = useDbStore.getState().cameras.find((c) => c.id === targetCam.id);
      expect(updated?.coords).toEqual([40.7128, -74.006]);
      expect(updated?.heading).toBe(90);

      // Verify unplaced count decremented
      const remainingUnplaced = selectUnplacedCameras(useDbStore.getState());
      expect(remainingUnplaced.length).toBe(6);

      // Verify audit trail entry
      const audit = useDbStore.getState().auditTrail;
      expect(audit.some((a) => a.action === 'CAMERA_GEO_PLACED')).toBe(true);
    });

    test('2.2 Adding and deleting topology transitions updates version and graph', () => {
      const initialVersion = selectTopologyVersion(useDbStore.getState());
      const initialTransitions = selectTopologyTransitions(useDbStore.getState());

      // Add edge
      useDbStore.getState().addTopologyTransition({
        fromCamera: 'cam_001',
        toCamera: 'cam_018',
        minTravelSec: 40,
        maxTravelSec: 150,
        distanceMeters: 105,
        isTwoWay: true,
        source: 'manual',
      });

      expect(selectTopologyVersion(useDbStore.getState())).toBe(initialVersion + 1);
      const updatedTransitions = selectTopologyTransitions(useDbStore.getState());
      expect(updatedTransitions.length).toBe(initialTransitions.length + 1);

      // Delete edge
      useDbStore.getState().deleteTopologyTransition('cam_001', 'cam_018');
      expect(selectTopologyVersion(useDbStore.getState())).toBe(initialVersion + 2);
    });

    test('2.3 Bulk updating AI policy enables tracking across selected cameras', () => {
      useDbStore.getState().bulkUpdateAiPolicy(['cam_001', 'cam_002'], true);

      const cam1 = useDbStore.getState().cameras.find((c) => c.id === 'cam_001');
      const cam2 = useDbStore.getState().cameras.find((c) => c.id === 'cam_002');
      expect(cam1?.aiPolicy?.enabled).toBe(true);
      expect(cam2?.aiPolicy?.enabled).toBe(true);
    });
  });

  describe('3. Camera Detail Panel & Offline Suppression', () => {
    test('3.1 Live camera shows stream player and primary cameraCode', () => {
      const liveCam: Camera = {
        id: 'cam_001',
        cameraCode: 'CAM-001',
        name: 'CAM-01 Concourse North',
        locationName: 'North Station Metro - Main Turnstiles',
        siteName: 'Metro Central Concourse',
        zone: 'Zone A - Entrance',
        status: 'live',
        sourceType: 'cctv_rtsp',
        peopleCount: 42,
        fps: 30,
        coords: [40.758896, -73.98513],
        lastPing: '2s ago',
        rtspUrl: 'rtsp://camera-edge-01.transit.internal/live/concourse-n',
        thumbnailUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957',
        heading: 45,
        fovDegrees: 75,
      };

      render(
        <CameraDetailPanel
          camera={liveCam}
          onClose={jest.fn()}
        />,
      );

      expect(screen.getByText('CAM-001')).toBeInTheDocument();
      expect(screen.getAllByText('CAM-01 Concourse North').length).toBeGreaterThan(0);
      expect(screen.getByText('SIMULATED FEED · SUBSTREAM (720p)')).toBeInTheDocument();
      expect(screen.getByTestId('mock-camera-player')).toBeInTheDocument();
    });

    test('3.2 Offline camera suppresses active tracks and renders offline snapshot alert', () => {
      const offlineCam: Camera = {
        id: 'cam_006',
        cameraCode: 'CAM-006',
        name: 'CAM-006: North Gate Security N6',
        locationName: 'North Gate Security',
        siteName: 'North Gate Security',
        zone: 'Zone B - Floor 1',
        status: 'offline',
        sourceType: 'cctv_rtsp',
        peopleCount: 0,
        fps: 0,
        coords: [40.7155, -74.003],
        lastPing: '14m ago',
        rtspUrl: 'rtsp://camera-edge-06.transit.internal/live/cam_006',
        thumbnailUrl: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0',
      };

      render(
        <CameraDetailPanel
          camera={offlineCam}
          onClose={jest.fn()}
        />,
      );

      expect(screen.getByText('CAM-006')).toBeInTheDocument();
      expect(screen.getByText('Camera Stream Offline')).toBeInTheDocument();
      expect(screen.getByText('Last frame received 14 minutes ago')).toBeInTheDocument();
      expect(screen.getByText('No active tracks or detection overlays')).toBeInTheDocument();

      // Camera player should NOT be rendered for offline feed
      expect(screen.queryByTestId('mock-camera-player')).not.toBeInTheDocument();
    });
  });

  describe('4. Unplaced Cameras & Lasso Bar', () => {
    test('4.1 UnplacedCamerasTray shows chip with unplaced count', () => {
      render(
        <UnplacedCamerasTray
          onStartPlacingCamera={jest.fn()}
        />,
      );

      expect(screen.getByText('7 Unplaced Cameras')).toBeInTheDocument();
    });

    test('4.2 LassoActionBar displays selection count and handles export', () => {
      const mockExport = jest.fn();
      const mockEnableAi = jest.fn();

      render(
        <LassoActionBar
          selectedCameraIds={['cam_001', 'cam_002', 'cam_003']}
          onClearSelection={jest.fn()}
          onBulkEnableAi={mockEnableAi}
          onExportCsv={mockExport}
        />,
      );

      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('cameras selected')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Export CSV'));
      expect(mockExport).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('Enable AI'));
      expect(mockEnableAi).toHaveBeenCalledTimes(1);
    });
  });
});
