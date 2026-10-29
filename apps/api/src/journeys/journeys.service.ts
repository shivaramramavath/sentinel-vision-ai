import { Injectable, NotFoundException } from '@nestjs/common';
import { SightingsService } from '../sightings/sightings.service';
import { CamerasService } from '../cameras/cameras.service';

export interface JourneyNode {
  id: string;
  order: number;
  cameraId: string;
  cameraName: string;
  locationName: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  confidence: 'low' | 'medium' | 'high';
  fusedScore: number;
  thumbnailUrl: string;
  status: 'confirmed' | 'possible';
}

export interface JourneyTransition {
  fromNodeId: string;
  toNodeId: string;
  travelTimeSec: number;
  distanceMeters: number;
  speedKmh: number;
  plausibility: 'plausible' | 'unlikely' | 'anomaly';
}

export interface CaseJourney {
  caseId: string;
  totalSightings: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  distanceMeters: number;
  nodes: JourneyNode[];
  transitions: JourneyTransition[];
}

@Injectable()
export class JourneysService {
  constructor(
    private readonly sightingsService: SightingsService,
    private readonly camerasService: CamerasService,
  ) {}

  async getJourneyForCase(caseId: string): Promise<CaseJourney> {
    const sightings = await this.sightingsService.findAll(caseId);
    if (!sightings || sightings.length === 0) {
      return {
        caseId,
        totalSightings: 0,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        durationMinutes: 0,
        distanceMeters: 0,
        nodes: [],
        transitions: [],
      };
    }

    // Sort chronologically ascending
    const sorted = [...sightings].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    const cameras = await this.camerasService.findAll();
    const cameraMap = new Map(cameras.map((c) => [c.id, c]));

    const nodes: JourneyNode[] = sorted.map((s, idx) => {
      const cam = cameraMap.get(s.cameraId);
      return {
        id: `node_${idx + 1}`,
        order: idx + 1,
        cameraId: s.cameraId,
        cameraName: cam?.name || s.cameraLocation,
        locationName: cam?.locationName || s.cameraLocation,
        latitude: cam?.latitude || 17.385,
        longitude: cam?.longitude || 78.4867,
        timestamp: s.timestamp,
        confidence: s.confidence,
        fusedScore: s.fusedScore,
        thumbnailUrl: s.thumbnailUrl,
        status: s.status === 'confirmed' ? 'confirmed' : 'possible',
      };
    });

    const transitions: JourneyTransition[] = [];
    let totalDistanceMeters = 0;

    for (let i = 0; i < nodes.length - 1; i++) {
      const from = nodes[i];
      const to = nodes[i + 1];

      const t1 = new Date(from.timestamp).getTime();
      const t2 = new Date(to.timestamp).getTime();
      const travelSec = Math.max(1, Math.round((t2 - t1) / 1000));

      // Rough distance approximation
      const latDiff = Math.abs(to.latitude - from.latitude) * 111000;
      const lonDiff = Math.abs(to.longitude - from.longitude) * 111000;
      const dist = Math.round(Math.sqrt(latDiff * latDiff + lonDiff * lonDiff)) || 250;
      totalDistanceMeters += dist;

      const speedKmh = Math.round((dist / travelSec) * 3.6 * 10) / 10;
      const plausibility = speedKmh > 80 ? 'anomaly' : speedKmh > 40 ? 'unlikely' : 'plausible';

      transitions.push({
        fromNodeId: from.id,
        toNodeId: to.id,
        travelTimeSec: travelSec,
        distanceMeters: dist,
        speedKmh,
        plausibility,
      });
    }

    const startMs = new Date(nodes[0].timestamp).getTime();
    const endMs = new Date(nodes[nodes.length - 1].timestamp).getTime();
    const durationMinutes = Math.round((endMs - startMs) / 60000);

    return {
      caseId,
      totalSightings: nodes.length,
      startTime: nodes[0].timestamp,
      endTime: nodes[nodes.length - 1].timestamp,
      durationMinutes,
      distanceMeters: totalDistanceMeters,
      nodes,
      transitions,
    };
  }
}
