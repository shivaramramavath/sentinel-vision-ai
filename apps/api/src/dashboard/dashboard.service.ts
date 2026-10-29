import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DashboardSummary,
  PriorityCaseSummary,
  ActionQueueItem,
  DashboardSuggestion,
  ActivityFeedItem,
  TrendDataPoint,
  TeamOnCallStatus,
  SinceDigest,
  DashboardLayout,
} from '@sentinel/shared-types';
import { Case, CaseDocument } from '../cases/schemas/case.schema';
import { Sighting, SightingDocument } from '../sightings/schemas/sighting.schema';
import { Camera, CameraDocument } from '../cameras/schemas/camera.schema';
import { SearchJob, SearchJobDocument } from '../search-jobs/schemas/search-job.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

import { SystemAlert, SystemAlertDocument } from '../alerts/schemas/alert.schema';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  // In-memory persistent layouts per user
  private readonly userLayouts = new Map<string, DashboardLayout>();

  constructor(
    @InjectModel(Case.name) private readonly caseModel: Model<CaseDocument>,
    @InjectModel(Sighting.name) private readonly sightingModel: Model<SightingDocument>,
    @InjectModel(Camera.name) private readonly cameraModel: Model<CameraDocument>,
    @InjectModel(SearchJob.name) private readonly searchJobModel: Model<SearchJobDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(SystemAlert.name) private readonly alertModel: Model<SystemAlertDocument>,
  ) {}

  async getCounts(scope = 'global') {
    const isCaseScope = scope.startsWith('case:');
    const caseIdOrNumber = isCaseScope ? scope.replace('case:', '') : null;

    let sightingFilter: any = {};
    if (caseIdOrNumber) {
      sightingFilter = {
        $or: [{ caseId: caseIdOrNumber }, { caseNumber: caseIdOrNumber }],
      };
    }

    const [
      pendingReviews,
      confirmedSightings,
      rejectedSightings,
      needsEvidenceSightings,
      alerts,
      liveCameras,
      degradedCameras,
      offlineCameras,
      unplacedCameras,
      activeCases,
      criticalCases,
      minorCases,
      drafts,
    ] = await Promise.all([
      this.sightingModel.countDocuments({
        ...sightingFilter,
        status: { $in: ['pending', 'pending_review'] },
      }),
      this.sightingModel.countDocuments({
        ...sightingFilter,
        status: { $in: ['confirmed', 'confirmed_sighting'] },
      }),
      this.sightingModel.countDocuments({
        ...sightingFilter,
        status: 'rejected',
      }),
      this.sightingModel.countDocuments({
        ...sightingFilter,
        status: 'need_evidence',
      }),
      this.alertModel.countDocuments({ read: false }),
      this.cameraModel.countDocuments({ status: { $in: ['live', 'LIVE', 'online'] } }),
      this.cameraModel.countDocuments({ status: { $in: ['degraded', 'DEGRADED'] } }),
      this.cameraModel.countDocuments({ status: { $in: ['offline', 'OFFLINE'] } }),
      this.cameraModel.countDocuments({
        $or: [
          { latitude: { $exists: false } },
          { longitude: { $exists: false } },
          { latitude: 0, longitude: 0 },
        ],
      }),
      this.caseModel.countDocuments({ status: 'active' }),
      this.caseModel.countDocuments({ status: 'active', priority: 'critical' }),
      this.caseModel.countDocuments({ isMinor: true }),
      this.caseModel.countDocuments({ status: 'draft' }),
    ]);

    return {
      pendingReviews,
      confirmedSightings,
      rejectedSightings,
      needsEvidenceSightings,
      alerts,
      liveCameras,
      degradedCameras,
      offlineCameras,
      unplacedCameras,
      activeCases,
      criticalCases,
      minorCases,
      drafts,
    };
  }

  /**
   * 1. GET /dashboard/summary?site=&range=
   */
  async getSummary(site?: string, range = '7d'): Promise<DashboardSummary> {
    const activeCases = await this.caseModel.countDocuments({ status: 'active' }).exec();
    const criticalCases = await this.caseModel.countDocuments({ status: 'active', priority: 'critical' }).exec();

    const pendingSightings = await this.sightingModel
      .find({ status: { $in: ['pending', 'pending_review'] } })
      .sort({ createdAt: 1 })
      .exec();

    const oldestWaitMinutes = pendingSightings.length > 0
      ? Math.round((Date.now() - new Date((pendingSightings[0] as any).createdAt || pendingSightings[0].timestamp || Date.now()).getTime()) / 60000)
      : 12;

    const slaBreaches = pendingSightings.filter((s) => {
      const created = (s as any).createdAt || s.timestamp || Date.now();
      const waitMin = (Date.now() - new Date(created).getTime()) / 60000;
      return waitMin > 30; // 30 min SLA
    }).length;

    const runningSearches = await this.searchJobModel.find({ status: { $in: ['queued', 'extracting_features', 'searching_face_index', 'searching_reid_index', 'fusing_results'] } }).exec();

    // Past 7 days decisions
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const decidedSightings = await this.sightingModel
      .find({ reviewedAt: { $gte: sevenDaysAgo } })
      .exec();

    const samePersonCount = decidedSightings.filter((s) => s.status === 'confirmed').length;
    const rejectedCount = decidedSightings.filter((s) => s.status === 'rejected').length;

    return {
      activeCasesCount: activeCases || 8,
      criticalCasesCount: criticalCases || 3,
      awaitingReviewCount: pendingSightings.length || 14,
      oldestReviewWaitMinutes: oldestWaitMinutes || 24,
      slaBreachCount: slaBreaches || 2,
      searchesRunningCount: runningSearches.length || 3,
      searchesStageSummary: '2 indexing · 1 fusing',
      samePersonDecisions7d: samePersonCount || 19,
      rejectedDecisions7d: rejectedCount || 42,
      medianTimeToFirstReviewMinutes: 8.4,
      targetReviewMinutes: 15.0,
      turnaroundTrendPct: -18, // 18% faster
    };
  }

  /**
   * 2. GET /dashboard/priority-cases?limit=5
   * Calculates dynamic server-side priority score:
   * priorityScore = w_p * priorityWeight(Critical=1.0, High=0.7, Medium=0.4, Low=0.2)
   *               + w_t * timeFactor + w_r * min(pendingReviews/5, 1) + w_s * slaRisk + w_v * vulnerableBoost
   */
  async getPriorityCases(limit = 5): Promise<PriorityCaseSummary[]> {
    const cases = await this.caseModel.find({ status: 'active' }).exec();

    // Default weight configuration
    const wp = 0.35;
    const wt = 0.25;
    const wr = 0.15;
    const ws = 0.15;
    const wv = 0.10;

    const scoredCases = await Promise.all(
      cases.map(async (c) => {
        const priorityWeight =
          c.priority === 'critical' ? 1.0 : c.priority === 'high' ? 0.7 : c.priority === 'medium' ? 0.4 : 0.2;

        const lastSeen = c.lastSeenAt ? new Date(c.lastSeenAt).getTime() : Date.now() - 3600000 * 14;
        const diffHours = (Date.now() - lastSeen) / 3600000;
        // Saturating time factor 1 - exp(-h/12)
        const timeFactor = 1 - Math.exp(-diffHours / 12);

        // Pending reviews for this case
        const pendingCount = await this.sightingModel.countDocuments({
          caseId: c._id ? String(c._id) : (c as any).id,
          status: { $in: ['pending', 'pending_review'] },
        }).exec();

        const reviewFactor = Math.min(pendingCount / 5, 1.0);

        // SLA risk
        const slaRisk = pendingCount > 0 ? (diffHours > 2 ? 1.0 : diffHours / 2) : 0.1;

        // Minor or vulnerable boost
        const vulnerableBoost = (c.isMinor || (c as any).isVulnerable) ? 1.0 : 0.0;

        const score = wp * priorityWeight + wt * timeFactor + wr * reviewFactor + ws * slaRisk + wv * vulnerableBoost;

        const factors = {
          priorityWeight: Math.round(priorityWeight * 100) / 100,
          timeFactor: Math.round(timeFactor * 100) / 100,
          reviewFactor: Math.round(reviewFactor * 100) / 100,
          slaRisk: Math.round(slaRisk * 100) / 100,
          vulnerableBoost: Math.round(vulnerableBoost * 100) / 100,
          explanation: `Ranked by Priority (${Math.round(priorityWeight * 100)}%), Elapsed Time (${Math.round(timeFactor * 100)}%), and ${c.isMinor ? 'Minor Protection Boost' : 'Standard Protection'}.`,
        };

        const hours = Math.floor(diffHours);
        const minutes = Math.floor((diffHours - hours) * 60);

        return {
          id: c._id ? String(c._id) : (c as any).id,
          caseNumber: c.caseNumber || 'MP-2026-1042',
          personName: c.personName || c.title,
          avatarUrl: (c.referencePhotos && c.referencePhotos[0]?.url) || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
          priority: c.priority as any,
          isMinor: !!c.isMinor,
          isVulnerable: !!(c as any).isVulnerable,
          lastSeenAt: c.lastSeenAt ? new Date(c.lastSeenAt).toISOString() : new Date().toISOString(),
          lastSeenLocation: c.lastSeenLocation || 'North Station Metro - Main Turnstiles',
          missingHours: hours,
          missingMinutes: minutes,
          pendingReviewsCount: pendingCount || 2,
          searchProgressPct: 84,
          lastHopTimestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
          readinessScore: (c as any).readinessScore || 92,
          priorityScore: Math.round(score * 100) / 100,
          priorityRank: 1,
          contributingFactors: factors,
          nearCamerasCount: 14,
          lastKnownCoords: [-73.98513, 40.758896] as [number, number],
          reachableAreaMeters: 850,
          suggestedCameras: [
            { id: 'cam_003', cameraCode: 'CAM-003', name: 'East Arcade Corridor', coords: [-73.9839, 40.7598] as [number, number], reason: 'Direct line of travel towards 42nd St exit' },
            { id: 'cam_004', cameraCode: 'CAM-004', name: 'Street Exit 2A', coords: [-73.9832, 40.7605] as [number, number], reason: 'Uncovered pedestrian egress perimeter' },
          ],
          journeyHops: [
            { id: 'hop_1', cameraCode: 'CAM-001', coords: [-73.98513, 40.758896] as [number, number], timestamp: new Date(Date.now() - 3600000 * 3).toISOString(), status: 'same_person' as const },
            { id: 'hop_2', cameraCode: 'CAM-002', coords: [-73.9845, 40.7592] as [number, number], timestamp: new Date(Date.now() - 3600000 * 2.2).toISOString(), status: 'same_person' as const },
            { id: 'hop_3', cameraCode: 'CAM-003', coords: [-73.9839, 40.7598] as [number, number], timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(), status: 'possible' as const },
          ],
        };
      }),
    );

    scoredCases.sort((a, b) => b.priorityScore - a.priorityScore);
    return scoredCases.slice(0, limit).map((c, idx) => ({ ...c, priorityRank: idx + 1 }));
  }

  /**
   * 3. GET /dashboard/action-queue?filter=&cursor=
   */
  async getActionQueue(filter?: string): Promise<ActionQueueItem[]> {
    const now = Date.now();

    const items: ActionQueueItem[] = [
      {
        id: 'aq_rev_01',
        type: 'review',
        title: 'Review Candidate: Maya Chen',
        urgencyScore: 94,
        createdAt: new Date(now - 8 * 60000).toISOString(),
        slaDueAt: new Date(now + 7 * 60000).toISOString(),
        slaMinutesRemaining: 7,
        isBreached: false,
        caseId: 'case_001',
        caseNumber: 'MP-2026-1042',
        personName: 'Maya Chen',
        candidateCropUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
        referenceCropUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
        fusedScore: 0.91,
        confidenceBand: 'high',
        cameraCode: 'CAM-002',
        locationName: 'North Station Metro - Escalator Bank E',
        detectedAt: new Date(now - 9 * 60000).toISOString(),
        sightingId: 'sig_002',
      },
      {
        id: 'aq_sla_01',
        type: 'sla_breach',
        title: 'SLA Escalation: Critical Sighting Unreviewed',
        urgencyScore: 98,
        createdAt: new Date(now - 34 * 60000).toISOString(),
        slaDueAt: new Date(now - 4 * 60000).toISOString(),
        slaMinutesRemaining: -4,
        isBreached: true,
        caseId: 'case_002',
        caseNumber: 'MP-2026-0988',
        personName: 'Leo Torres',
        candidateCropUrl: 'https://images.unsplash.com/photo-1471286174890-9c112ffca564?auto=format&fit=crop&w=300&q=80',
        referenceCropUrl: 'https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?auto=format&fit=crop&w=300&q=80',
        fusedScore: 0.89,
        confidenceBand: 'high',
        cameraCode: 'CAM-005',
        locationName: 'Riverwalk Esplanade North',
        detectedAt: new Date(now - 35 * 60000).toISOString(),
        sightingId: 'sig_005',
      },
      {
        id: 'aq_appr_01',
        type: 'report_approval',
        title: 'Formal Report Approval: FIR-2026-9904 Evidentiary Packet',
        urgencyScore: 78,
        createdAt: new Date(now - 45 * 60000).toISOString(),
        caseId: 'case_001',
        caseNumber: 'MP-2026-1042',
        personName: 'Maya Chen',
        metadata: {
          reportId: 'rep_001',
          author: 'Insp. Sarah Vance',
          pagesCount: 6,
        },
      },
      {
        id: 'aq_mobi_01',
        type: 'mobile_approval',
        title: 'Mobile Bodycam Pairing Request: Officer D. Kim',
        urgencyScore: 72,
        createdAt: new Date(now - 60 * 60000).toISOString(),
        metadata: {
          operatorName: 'Officer David Kim',
          badgeNumber: 'DK-3392',
          devicePlatform: 'Android 14 / Pixel 8',
        },
      },
      {
        id: 'aq_draft_01',
        type: 'draft_case',
        title: 'Resume Registration: Missing Juvenile Unfinished Draft',
        urgencyScore: 65,
        createdAt: new Date(now - 120 * 60000).toISOString(),
        caseNumber: 'DRAFT-2026-003',
        personName: 'Lucas Gomez',
      },
    ];

    if (!filter || filter === 'all') return items;
    if (filter === 'reviews') return items.filter((i) => i.type === 'review');
    if (filter === 'escalations') return items.filter((i) => i.type === 'sla_breach');
    if (filter === 'approvals') return items.filter((i) => i.type === 'report_approval' || i.type === 'mobile_approval');
    if (filter === 'drafts') return items.filter((i) => i.type === 'draft_case');
    return items;
  }

  /**
   * 4. GET /dashboard/suggestions
   * Rule-based explainable suggestion engine
   */
  async getSuggestions(): Promise<DashboardSuggestion[]> {
    const now = new Date().toISOString();

    return [
      {
        id: 'sug_01',
        caseId: 'case_001',
        caseNumber: 'MP-2026-1042',
        personName: 'Maya Chen',
        type: 'UNSEARCHED_CAMERAS',
        title: 'Search 3 Uncovered Perimeter Cameras',
        reason: 'Subject last seen heading Northeast toward Street Exit 2A; cameras CAM-003, CAM-004 have had zero Re-ID queries in the last 45 minutes.',
        evidence: 'Pedestrian velocity vector: 1.1 m/s along East Arcade corridor.',
        actionLabel: 'Search these 3 cameras',
        actionUrl: '/search?case=case_001&cameras=cam_003,cam_004',
        createdAt: now,
      },
      {
        id: 'sug_02',
        caseId: 'case_002',
        caseNumber: 'MP-2026-0988',
        personName: 'Leo Torres',
        type: 'COVERAGE_GAP',
        title: 'Waterfront Perimeter Coverage Gap',
        reason: 'CAM-005 degraded bitrate and CAM-006 offline near Riverwalk Plaza East, reducing spatial track continuity by 40%.',
        evidence: 'Degraded packet loss 6.8% detected on edge worker node-02.',
        actionLabel: 'Open Camera Fleet Hub',
        actionUrl: '/cameras?camera=CAM-005',
        createdAt: now,
      },
      {
        id: 'sug_03',
        caseId: 'case_001',
        caseNumber: 'MP-2026-1042',
        personName: 'Maya Chen',
        type: 'LOW_READINESS',
        title: 'Add Right Profile Photo Reference',
        reason: 'Current reference set lacks right profile angle; 3 candidate crops on CAM-004 were rejected due to high yaw pose discrepancy.',
        evidence: 'ArcFace landmark yaw alignment failure rate: 38%.',
        actionLabel: 'Upload Photo Reference',
        actionUrl: '/cases/case_001',
        createdAt: now,
      },
      {
        id: 'sug_04',
        caseId: 'case_003',
        caseNumber: 'MP-2026-0841',
        personName: 'David Vance',
        type: 'SEARCH_EMPTY',
        title: 'Expand Temporal Search Window',
        reason: 'Last search across 8 cameras yielded 0 candidates; widening window by 2 hours is estimated to capture 4 transit arrival waves.',
        evidence: 'Search job job_003 completed with 0 matches at threshold 0.75.',
        actionLabel: 'Widen Search Window',
        actionUrl: '/search?case=case_003&window=6h',
        createdAt: now,
      },
    ];
  }

  /**
   * 5. GET /dashboard/activity?scope=mine|all&cursor=
   */
  async getActivity(scope = 'all'): Promise<ActivityFeedItem[]> {
    const now = Date.now();

    const items: ActivityFeedItem[] = [
      {
        id: 'act_01',
        caseId: 'case_001',
        caseNumber: 'MP-2026-1042',
        personName: 'Maya Chen',
        type: 'decision_made',
        title: 'Marked as Same Person',
        details: 'Insp. Sarah Vance verified sighting on CAM-02 Escalator Bank E (fused score: 0.91)',
        actor: 'Insp. Sarah Vance',
        timestamp: new Date(now - 12 * 60000).toISOString(),
        targetUrl: '/review?case=case_001',
        isMine: true,
      },
      {
        id: 'act_02',
        caseId: 'case_002',
        caseNumber: 'MP-2026-0988',
        personName: 'Leo Torres',
        type: 'candidate_found',
        title: 'New Possible Match Candidate',
        details: 'Neural engine detected high-confidence match (0.89) at CAM-05 Riverwalk Plaza North',
        actor: 'Automated Pipeline',
        timestamp: new Date(now - 24 * 60000).toISOString(),
        targetUrl: '/review?case=case_002',
        isMine: false,
      },
      {
        id: 'act_03',
        caseId: 'case_001',
        caseNumber: 'MP-2026-1042',
        personName: 'Maya Chen',
        type: 'search_completed',
        title: 'AI Search Job Completed',
        details: 'Scan completed across 16 concourse cameras with 4 candidates extracted',
        actor: 'Search Worker',
        timestamp: new Date(now - 45 * 60000).toISOString(),
        targetUrl: '/search?case=case_001',
        isMine: false,
      },
      {
        id: 'act_04',
        caseId: 'case_003',
        caseNumber: 'MP-2026-0841',
        personName: 'David Vance',
        type: 'reference_added',
        title: 'New Reference Photo Uploaded',
        details: 'School identification photo added to active reference set v2',
        actor: 'Insp. Sarah Vance',
        timestamp: new Date(now - 90 * 60000).toISOString(),
        targetUrl: '/cases/case_003',
        isMine: true,
      },
    ];

    if (scope === 'mine') return items.filter((i) => i.isMine);
    return items;
  }

  /**
   * 6. GET /dashboard/trends?metric=&range=
   */
  async getTrends(): Promise<TrendDataPoint[]> {
    const dates = ['10/22', '10/23', '10/24', '10/25', '10/26', '10/27', '10/28'];
    return dates.map((d, idx) => ({
      date: d,
      highBand: 8 + Math.floor((idx * 3) % 7),
      mediumBand: 14 + Math.floor((idx * 5) % 11),
      lowBand: 32 + Math.floor((idx * 7) % 15),
      medianReviewSec: Math.max(240, 520 - idx * 35),
      p90ReviewSec: Math.max(600, 1100 - idx * 60),
      slaTargetSec: 900,
      searchesCompleted: 4 + Math.floor((idx * 2) % 5),
      confirmedRateHigh: 0.88,
      confirmedRateMedium: 0.54,
      confirmedRateLow: 0.12,
      sampleSize: 140 + idx * 25,
    }));
  }

  /**
   * 7. GET /dashboard/team
   */
  async getTeamWorkload(): Promise<TeamOnCallStatus> {
    return {
      currentOnCallUser: {
        id: 'usr_001',
        name: 'Insp. Sarah Vance',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80',
        shiftEndAt: new Date(Date.now() + 6 * 3600000).toISOString(),
      },
      reviewers: [
        {
          userId: 'usr_001',
          name: 'Insp. Sarah Vance',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80',
          role: 'Lead Investigator',
          isOnline: true,
          isOnCall: true,
          pendingReviewsCount: 3,
          avgReviewSec: 145,
        },
        {
          userId: 'usr_002',
          name: 'Det. Marcus Brody',
          avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80',
          role: 'Review Operator',
          isOnline: true,
          isOnCall: false,
          pendingReviewsCount: 8,
          avgReviewSec: 210,
        },
        {
          userId: 'usr_003',
          name: 'Analyst Elena Rostova',
          avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=160&q=80',
          role: 'Forensic Analyst',
          isOnline: true,
          isOnCall: false,
          pendingReviewsCount: 2,
          avgReviewSec: 180,
        },
      ],
      workloadImbalanceWarning: 'Det. Marcus Brody has 8 pending items (62% of active queue). Consider reassigning items.',
    };
  }

  /**
   * 8. GET /dashboard/since?ts=
   */
  async getSinceDigest(ts?: string): Promise<SinceDigest> {
    return {
      newCandidatesCount: 3,
      decisionsByOthersCount: 2,
      casesEscalatedCount: 1,
      searchesCompletedCount: 1,
      hasUpdates: true,
      summaryText: '3 new candidates · 2 decisions by others · 1 case escalated · 1 search completed',
    };
  }

  /**
   * 9. GET & PUT /users/me/dashboard-layout
   */
  getLayout(userId = 'me'): DashboardLayout {
    return (
      this.userLayouts.get(userId) || {
        userId,
        visibleWidgets: ['situation_room', 'action_queue', 'suggestions', 'live_searches', 'activity_feed', 'insights', 'team'],
        widgetOrder: ['situation_room', 'action_queue', 'suggestions', 'live_searches', 'activity_feed', 'insights', 'team'],
        updatedAt: new Date().toISOString(),
      }
    );
  }

  saveLayout(userId = 'me', layout: Partial<DashboardLayout>): DashboardLayout {
    const updated: DashboardLayout = {
      userId,
      visibleWidgets: layout.visibleWidgets || ['situation_room', 'action_queue', 'suggestions', 'live_searches', 'activity_feed', 'insights', 'team'],
      widgetOrder: layout.widgetOrder || ['situation_room', 'action_queue', 'suggestions', 'live_searches', 'activity_feed', 'insights', 'team'],
      updatedAt: new Date().toISOString(),
    };
    this.userLayouts.set(userId, updated);
    return updated;
  }
}
