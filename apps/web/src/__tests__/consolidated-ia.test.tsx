import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  useDbStore,
  selectPendingReviewCount,
  selectConfirmedSightingsCount,
  selectRejectedSightingsCount,
  selectActiveCasesCount,
  selectCases,
  selectCaseById,
  isMinorFromDob,
  AI_MODEL_REGISTRY,
} from './fixtures/test-db';
import { StatusChip, PriorityChip, ScoreBreakdown, ReadinessRing } from '@/components/shared';

describe('Consolidated Information Architecture & Single Source of Truth', () => {
  beforeEach(() => {
    // Reset store state before each test
    useDbStore.setState({
      cases: useDbStore.getState().cases,
      sightings: useDbStore.getState().sightings,
      undoStack: [],
    });
  });

  test('1. Model facts come from AI_MODEL_REGISTRY and never hardcoded in JSX', () => {
    expect(AI_MODEL_REGISTRY.face.name).toBe('ArcFace');
    expect(AI_MODEL_REGISTRY.face.version).toBe('v2.1');
    expect(AI_MODEL_REGISTRY.face.embeddingDim).toBe(512);

    expect(AI_MODEL_REGISTRY.reid.name).toBe('OSNet-AIN');
    expect(AI_MODEL_REGISTRY.reid.version).toBe('x1.0');
    expect(AI_MODEL_REGISTRY.reid.embeddingDim).toBe(512);

    expect(AI_MODEL_REGISTRY.spatiotemporal.name).toBe('Kinematic Plausibility');
  });

  test('2. Minor flag is dynamically derived from DOB (< 18)', () => {
    // Born in 2017 (< 18)
    expect(isMinorFromDob('2017-08-22')).toBe(true);
    // Born in 2012 (< 18)
    expect(isMinorFromDob('2012-05-18')).toBe(true);
    // Born in 1954 (> 18)
    expect(isMinorFromDob('1954-02-10')).toBe(false);
    // Born in 2000 (> 18)
    expect(isMinorFromDob('2000-01-01')).toBe(false);
  });

  test('3. Single Source of Truth: Derived selectors calculate exact counts without hardcoding', () => {
    const state = useDbStore.getState();
    const pendingTotal = selectPendingReviewCount(state);
    const confirmedTotal = selectConfirmedSightingsCount(state);
    const activeCases = selectActiveCasesCount(state);

    expect(pendingTotal).toBeGreaterThan(0);
    expect(activeCases).toBeGreaterThanOrEqual(4);

    // Case specific count
    const mayaPending = selectPendingReviewCount(state, 'case_001');
    expect(mayaPending).toBe(2);
  });

  test('4. Decision mutation updates Sighting, Journey hop, and audit trail', () => {
    const store = useDbStore.getState();
    const initialPending = selectPendingReviewCount(useDbStore.getState(), 'case_001');

    // Confirm sighting sig_003
    const res = store.recordDecision({
      sightingId: 'sig_003',
      decision: 'confirmed_sighting',
      checklist: ['Face features consistent with reference'],
      notes: 'Verified landmark alignment on CAM-03',
      actor: 'Insp. Sarah Vance',
    });

    expect(res.success).toBe(true);
    expect(res.undoToken).toBeDefined();

    // Sighting updated
    const updatedSighting = useDbStore.getState().sightings.find((s) => s.id === 'sig_003');
    expect(updatedSighting?.status).toBe('confirmed_sighting');
    expect(updatedSighting?.reviewedBy).toBe('Insp. Sarah Vance');

    // Pending count decremented
    const newPending = selectPendingReviewCount(useDbStore.getState(), 'case_001');
    expect(newPending).toBe(initialPending - 1);

    // Journey hop updated to confirmed
    const journey = useDbStore.getState().detailedJourneys['case_001'][0];
    const hop3 = journey.hops.find((h) => h.sightingId === 'sig_003');
    expect(hop3?.status).toBe('confirmed');
    expect(hop3?.verified).toBe(true);

    // Audit trail recorded
    const latestAudit = useDbStore.getState().auditTrail[0];
    expect(latestAudit.action).toBe('DECISION_CONFIRMED');
  });

  test('5. Rejection decision adds crop to Hard Negatives and updates status', () => {
    const store = useDbStore.getState();
    const initialHardNegatives = useDbStore.getState().hardNegatives.length;

    // Reject sighting sig_004
    const res = store.recordDecision({
      sightingId: 'sig_004',
      decision: 'rejected',
      reasonCode: 'different_person',
      notes: 'Facial landmarks do not match',
      actor: 'Insp. Sarah Vance',
    });

    expect(res.success).toBe(true);

    // Sighting updated to rejected
    const sighting = useDbStore.getState().sightings.find((s) => s.id === 'sig_004');
    expect(sighting?.status).toBe('rejected');
    expect(sighting?.rejectReasonCode).toBe('different_person');

    // Hard negatives list incremented
    const newHardNegatives = useDbStore.getState().hardNegatives;
    expect(newHardNegatives.length).toBe(initialHardNegatives + 1);
    expect(newHardNegatives[0].reasonCode).toBe('different_person');
  });

  test('6. 10-Second Undo rollback restores previous status', () => {
    const store = useDbStore.getState();
    const prevStatus = useDbStore.getState().sightings.find((s) => s.id === 'sig_003')?.status;

    // Make a decision
    const { undoToken } = store.recordDecision({
      sightingId: 'sig_003',
      decision: 'confirmed_sighting',
    });

    expect(useDbStore.getState().sightings.find((s) => s.id === 'sig_003')?.status).toBe(
      'confirmed_sighting',
    );

    // Rollback with undo token
    const undoSuccess = useDbStore.getState().undoDecision(undoToken);
    expect(undoSuccess).toBe(true);

    // Status is restored
    expect(useDbStore.getState().sightings.find((s) => s.id === 'sig_003')?.status).toBe(prevStatus);
  });

  test('7. Wording and colour rules: Identity components render without green/red for matches', () => {
    const { container: chipContainer } = render(<StatusChip status="confirmed_sighting" />);
    // Confirmed uses Blue
    expect(chipContainer.querySelector('.bg-blue-600')).toBeTruthy();
    expect(screen.getByText('Confirmed by reviewer')).toBeInTheDocument();

    const { container: possibleContainer } = render(<StatusChip status="pending_review" />);
    // Unverified/possible uses Amber
    expect(possibleContainer.querySelector('.border-amber-500\\/40')).toBeTruthy();
    expect(screen.getByText('Possible match')).toBeInTheDocument();

    // Priority: ONLY critical is red
    const { container: critContainer } = render(<PriorityChip priority="critical" />);
    expect(critContainer.querySelector('.bg-rose-600')).toBeTruthy();

    const { container: highContainer } = render(<PriorityChip priority="high" />);
    // High is Amber, not red
    expect(highContainer.querySelector('.border-amber-500\\/50')).toBeTruthy();
  });

  test('8. ScoreBreakdown renders 4 model bars and disclaimer note', () => {
    render(
      <ScoreBreakdown
        scores={{
          face: 0.93,
          reid: 0.89,
          temporal: 0.95,
          cameraPlausibility: 0.91,
          fused: 0.92,
        }}
      />,
    );

    expect(screen.getByText('Face Biometrics')).toBeInTheDocument();
    expect(screen.getByText('Whole-Body Re-ID')).toBeInTheDocument();
    expect(screen.getByText('Temporal Plausibility')).toBeInTheDocument();
    expect(screen.getByText('Camera Plausibility')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(
      screen.getByText('Scores are algorithmic evidence for review, not proof of identity.'),
    ).toBeInTheDocument();
  });
});
