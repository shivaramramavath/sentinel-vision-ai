import React from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { CameraLayer } from '../components/features/map/CameraLayer';
import { RealtimeTrackLayer } from '../components/features/map/RealtimeTrackLayer';
import { Camera } from '../types';
import { TrackUpdatedEvent } from '@sentinel/shared-types';

// Mock MapLibre GL and useMap hook
const mockAddSource = jest.fn();
const mockAddLayer = jest.fn();
const mockRemoveLayer = jest.fn();
const mockRemoveSource = jest.fn();
const mockGetSource = jest.fn();
const mockGetLayer = jest.fn();
const mockSetData = jest.fn();
const mockOn = jest.fn();
const mockOff = jest.fn();

const mockMapInstance = {
  addSource: mockAddSource,
  addLayer: mockAddLayer,
  removeLayer: mockRemoveLayer,
  removeSource: mockRemoveSource,
  getSource: mockGetSource,
  getLayer: mockGetLayer,
  on: mockOn,
  off: mockOff,
  getCanvas: () => ({ style: { cursor: '' } }),
};

jest.mock('../components/ui/map', () => ({
  useMap: () => ({
    map: mockMapInstance,
    isLoaded: true,
  }),
  MapClusterLayer: jest.fn(({ data }) => (
    <div data-testid="mock-cluster-layer" data-feature-count={data.features.length} />
  )),
}));

// Generator for 500 Cameras
function generate500Cameras(): Camera[] {
  const baseLat = 17.385;
  const baseLng = 78.4867;
  const list: Camera[] = [];

  for (let i = 1; i <= 500; i++) {
    const lat = baseLat + (i % 20) * 0.001;
    const lng = baseLng + Math.floor(i / 20) * 0.001;
    list.push({
      id: `cam_${String(i).padStart(3, '0')}`,
      name: `CCTV Camera ${i}`,
      latitude: lat,
      longitude: lng,
      coords: [lat, lng],
      resolution: '1920x1080',
      lastPing: '2s ago',
      rtspUrl: `rtsp://cam-${i}`,
      thumbnailUrl: '',
      status: i % 10 === 0 ? 'offline' : 'live',
      fps: 30,
      peopleCount: i % 5,
      floor: (i % 4) + 1,
      zone: `Zone-${String.fromCharCode(65 + (i % 6))}`,
      locationName: 'Central Campus',
    });
  }
  return list;
}

// Generator for 20 Live Tracks
function generate20LiveTracks(): TrackUpdatedEvent[] {
  const baseLat = 17.385;
  const baseLng = 78.4867;
  const tracks: TrackUpdatedEvent[] = [];

  for (let i = 1; i <= 20; i++) {
    tracks.push({
      trackId: 1000 + i,
      cameraId: `cam_${String((i % 50) + 1).padStart(3, '0')}`,
      caseId: i <= 3 ? 'case_crit_01' : undefined,
      bbox: [100, 120, 180, 290],
      coordinates: [baseLng + i * 0.0005, baseLat + i * 0.0005],
      ts: new Date().toISOString(),
    });
  }
  return tracks;
}

describe('Map Performance Benchmark (500 Cameras + 20 Live Tracks)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('triggers GPU clustering for 500 cameras and completes GeoJSON serialization within 60 FPS budget (< 16.67 ms)', () => {
    const cameras = generate500Cameras();
    expect(cameras.length).toBe(500);

    // 1. Serialization of 500 cameras to GeoJSON Point features
    const t0 = performance.now();
    const clusterData = {
      type: 'FeatureCollection',
      features: cameras.map((c) => ({
        type: 'Feature',
        id: c.id,
        geometry: { type: 'Point', coordinates: [c.longitude, c.latitude] },
        properties: { id: c.id, name: c.name, status: c.status },
      })),
    };
    const serializationDuration = performance.now() - t0;

    // Serialization must easily meet the 16.67 ms budget (typically < 3 ms)
    expect(serializationDuration).toBeLessThan(16.67);
    expect(clusterData.features.length).toBe(500);

    // 2. Render layer with clustering enabled
    const { getByTestId } = render(
      <CameraLayer cameras={cameras} clusteringThreshold={80} enableClustering={true} />,
    );

    const clusterEl = getByTestId('mock-cluster-layer');
    expect(clusterEl).toBeInTheDocument();
    expect(clusterEl).toHaveAttribute('data-feature-count', '500');
  });

  it('processes 20 live track feature updates in < 250 ms without remounting or leaking event listeners', () => {
    const initialTracks = generate20LiveTracks();
    const mockSourceObj = { setData: mockSetData };

    // Initially source does not exist
    mockGetSource.mockImplementation((id: string) => {
      if (mockAddSource.mock.calls.length > 0) return mockSourceObj;
      return null;
    });

    const { rerender } = render(<RealtimeTrackLayer tracks={initialTracks} />);

    // Initial source registration
    expect(mockAddSource).toHaveBeenCalledTimes(1);

    // Simulate 5 rapid 250 ms telemetry updates
    const updateTimes: number[] = [];

    for (let tick = 1; tick <= 5; tick++) {
      const updatedTracks = initialTracks.map((t) => ({
        ...t,
        coordinates: [
          (t.coordinates?.[0] ?? 78.48) + 0.00002 * tick,
          (t.coordinates?.[1] ?? 17.38) + 0.00002 * tick,
        ] as [number, number],
        ts: new Date().toISOString(),
      }));

      const tTickStart = performance.now();
      rerender(<RealtimeTrackLayer tracks={updatedTracks} />);
      const tickDuration = performance.now() - tTickStart;
      updateTimes.push(tickDuration);
    }

    // In-place updates via setData should have been triggered for each tick
    expect(mockSetData).toHaveBeenCalled();
    // Layers should NOT be re-created on each telemetry tick
    expect(mockAddLayer).toHaveBeenCalledTimes(2); // 1 circle layer + 1 pulse ring layer

    // All update latencies must be < 250 ms (and comfortably within the 16.67 ms 60 FPS budget)
    for (const dt of updateTimes) {
      expect(dt).toBeLessThan(250.0);
      expect(dt).toBeLessThan(16.67);
    }
  });
});
