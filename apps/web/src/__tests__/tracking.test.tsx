import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PersonSummaryStrip } from '../components/features/tracking/PersonSummaryStrip';
import { JourneyTimeline } from '../components/features/tracking/JourneyTimeline';
import { SelectedHopCard } from '../components/features/tracking/SelectedHopCard';
import { DetailedJourney, DetailedHopNode } from '../types/tracking';

const mockHop1: DetailedHopNode = {
  hopNumber: 1,
  sightingId: 'sight_01',
  cameraId: 'cam_01',
  cameraName: 'CAM-01: Main Concourse East',
  zone: 'Zone A - Concourse',
  coords: [40.7128, -74.006],
  timestamp: '2026-10-28T09:15:00Z',
  dwellTimeSeconds: 45,
  status: 'confirmed',
  verified: true,
  scores: {
    face: 0.88,
    reid: 0.85,
    temporal: 0.92,
    cameraPlausibility: 0.94,
    fused: 0.87,
  },
  thumbnails: {
    referenceUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2',
    cctvCropUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2',
    frameUrl: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0',
    faceDetected: true,
    qualityScore: 92,
  },
  trackId: 'TRK-9014',
  direction: 'North-East',
  reviewInfo: {
    reviewedBy: 'Insp. Sarah Vance',
    reviewedAt: '2026-10-28T09:20:00Z',
    notes: 'Verified against reference set',
  },
  transition: {
    elapsedSeconds: 0,
    distanceMeters: 0,
    speedMps: 0,
    plausibility: 'plausible',
  },
};

const mockHop2: DetailedHopNode = {
  hopNumber: 2,
  sightingId: 'sight_02',
  cameraId: 'cam_02',
  cameraName: 'CAM-02: Platform 3 Turnstiles',
  zone: 'Zone B - Platforms',
  coords: [40.7135, -74.0048],
  timestamp: '2026-10-28T09:22:00Z',
  dwellTimeSeconds: 120,
  status: 'possible',
  verified: false,
  scores: {
    face: 0.65,
    reid: 0.72,
    temporal: 0.85,
    cameraPlausibility: 0.89,
    fused: 0.71,
  },
  thumbnails: {
    referenceUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2',
    cctvCropUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
    frameUrl: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0',
    faceDetected: true,
    qualityScore: 78,
  },
  trackId: 'TRK-9022',
  direction: 'North',
  reviewInfo: {},
  transition: {
    elapsedSeconds: 420,
    distanceMeters: 210,
    speedMps: 0.5,
    plausibility: 'plausible',
  },
};

const mockJourneyA: DetailedJourney = {
  journeyId: 'A',
  caseId: 'case_test_01',
  caseNumber: 'MP-2026-1042',
  personName: 'Maya Chen',
  label: 'Journey A - 2 hops - best path',
  diffSummary: 'Primary hypothesis',
  confidence: 0.79,
  lowestConfidence: 0.71,
  totalDistanceMeters: 210,
  durationMinutes: 7,
  hopsCount: 2,
  confirmedCount: 1,
  possibleCount: 1,
  firstSeenAt: '2026-10-28T09:15:00Z',
  lastSeenAt: '2026-10-28T09:22:00Z',
  hops: [mockHop1, mockHop2],
  reachableArea: {
    center: [-74.0048, 40.7135],
    radiusMeters: 380,
    maxRadiusMeters: 1500,
    walkingSpeedMps: 1.4,
    elapsedMinutes: 4,
    label: 'Estimated reachable area (not a confirmed position)',
  },
  suggestedCameras: [
    {
      cameraId: 'cam_08',
      name: 'CAM-08: North Platform Escalators',
      coords: [40.7145, -74.004],
      distanceMeters: 180,
      expectedArrivalWindowMin: '2-4 min',
    },
  ],
};

describe('Cross-Camera Tracking Journey Feature Suite', () => {
  it('renders PersonSummaryStrip with vital case stats, last seen info, and compliance disclaimer', () => {
    const handleOpenNewSearch = jest.fn();
    render(
      <PersonSummaryStrip
        journey={mockJourneyA}
        onOpenNewSearch={handleOpenNewSearch}
      />,
    );

    expect(screen.getByText('Maya Chen')).toBeInTheDocument();
    expect(screen.getByText('MP-2026-1042')).toBeInTheDocument();
    expect(screen.getByText('Possible journey, requires human verification.')).toBeInTheDocument();
    expect(screen.getByText('2 hops')).toBeInTheDocument();
    expect(screen.getByText('210m')).toBeInTheDocument();
    expect(screen.getByText('71%')).toBeInTheDocument(); // lowest confidence

    const searchBtn = screen.getByText('Search footage for this person');
    fireEvent.click(searchBtn);
    expect(handleOpenNewSearch).toHaveBeenCalled();
  });

  it('renders JourneyTimeline with chronological hop cards, transition connectors, and end-of-timeline node', () => {
    const onSelectHopIndex = jest.fn();
    const onConfirmHop = jest.fn();
    const onRejectHop = jest.fn();
    const onOpenEvidenceModal = jest.fn();

    render(
      <JourneyTimeline
        journeys={[mockJourneyA]}
        selectedJourneyId="A"
        onSelectJourneyId={jest.fn()}
        selectedHopIndex={0}
        onSelectHopIndex={onSelectHopIndex}
        hoveredHopIndex={null}
        onHoverHopIndex={jest.fn()}
        onConfirmHop={onConfirmHop}
        onRejectHop={onRejectHop}
        onOpenEvidenceModal={onOpenEvidenceModal}
        onOpenSearchSheet={jest.fn()}
      />,
    );

    // Hops in timeline
    expect(screen.getByText('CAM-01: Main Concourse East')).toBeInTheDocument();
    expect(screen.getByText('CAM-02: Platform 3 Turnstiles')).toBeInTheDocument();

    // Transition plausibility connector chip
    expect(screen.getByText('Transition Plausible')).toBeInTheDocument();

    // End of timeline node with suggested cameras
    expect(screen.getByText('NOW')).toBeInTheDocument();
    expect(screen.getByText('CAM-08: North Platform Escalators')).toBeInTheDocument();

    // Clicking a hop selects it
    const hop2Card = screen.getByText('CAM-02: Platform 3 Turnstiles');
    fireEvent.click(hop2Card);
    expect(onSelectHopIndex).toHaveBeenCalledWith(1);
  });

  it('renders SelectedHopCard with reference vs candidate comparison and 4 model score bars', () => {
    const onConfirm = jest.fn();
    const onReject = jest.fn();

    render(
      <SelectedHopCard
        hop={mockHop1}
        onConfirm={onConfirm}
        onReject={onReject}
      />,
    );

    expect(screen.getByText('HOP #1')).toBeInTheDocument();
    expect(screen.getByText('CAM-01: Main Concourse East')).toBeInTheDocument();
    expect(screen.getByText('Reference vs CCTV Match')).toBeInTheDocument();
    expect(screen.getByText('Face Recognition (InsightFace ArcFace v2.1)')).toBeInTheDocument();
    expect(screen.getByText('Person Re-ID (OSNet-AIN x1.0 512-dim)')).toBeInTheDocument();
    expect(screen.getByText('Temporal Offset (NTP Calibrated Window)')).toBeInTheDocument();
    expect(screen.getByText('Camera Topology Plausibility (Graph Matrix)')).toBeInTheDocument();
    expect(screen.getByText('87%')).toBeInTheDocument(); // Fused Score
  });
});
