import { Model } from 'mongoose';
import { CameraDocument, SourceType } from '../cameras/schemas/camera.schema';

export const SURVEILLANCE_SITES = [
  { id: 'site_01', name: 'Terminal 1 Departures', baseLat: 17.3872, baseLng: 78.4891, floorCount: 3 },
  { id: 'site_02', name: 'Terminal 2 Arrivals', baseLat: 17.3831, baseLng: 78.4842, floorCount: 2 },
  { id: 'site_03', name: 'Metro Central Concourse', baseLat: 17.3850, baseLng: 78.4867, floorCount: 2 },
  { id: 'site_04', name: 'North Gate Security', baseLat: 17.3895, baseLng: 78.4878, floorCount: 1 },
  { id: 'site_05', name: 'South Bus Interchange', baseLat: 17.3812, baseLng: 78.4855, floorCount: 1 },
  { id: 'site_06', name: 'Duty Free Promenade', baseLat: 17.3861, baseLng: 78.4882, floorCount: 2 },
  { id: 'site_07', name: 'East Escalators Corridor', baseLat: 17.3868, baseLng: 78.4905, floorCount: 3 },
  { id: 'site_08', name: 'Baggage Reclaim Zone 4', baseLat: 17.3825, baseLng: 78.4830, floorCount: 1 },
];

export async function seedCameras(
  cameraModel: Model<CameraDocument>,
  options: { reset?: boolean } = {},
) {
  if (options.reset) {
    await cameraModel.deleteMany({ seed: true });
  }

  const totalCameras = 124;
  const cameras = [];

  for (let i = 1; i <= totalCameras; i++) {
    const siteIndex = (i - 1) % SURVEILLANCE_SITES.length;
    const site = SURVEILLANCE_SITES[siteIndex];
    const codeNum = String(i).padStart(3, '0');
    const cameraCode = `CAM-${codeNum}`;
    const cameraId = `cam_${codeNum}`;

    // Deterministic jitter
    const angle = (i * 137.5 * Math.PI) / 180;
    const radius = 0.0004 + (i % 7) * 0.0003;
    const lat = Number((site.baseLat + Math.sin(angle) * radius).toFixed(6));
    const lng = Number((site.baseLng + Math.cos(angle) * radius).toFixed(6));

    const isOffline = i === 14 || i === 89 || i === 112;
    const isDegraded = i === 42 || i === 67 || i === 105;
    const status = isOffline ? 'offline' : isDegraded ? 'degraded' : 'online';

    const floor = (i % site.floorCount) + 1;
    const zone = `Zone ${String.fromCharCode(65 + ((i - 1) % 6))}`;

    const cameraDoc = {
      id: cameraId,
      cameraId: cameraId,
      cameraCode: cameraCode,
      name: `${cameraCode} — ${site.name}`,
      locationName: `${site.name} (${zone})`,
      siteId: site.id,
      buildingId: `bld_${site.id}`,
      floor: floor,
      zone: zone,
      latitude: lat,
      longitude: lng,
      location: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      heading: (i * 47) % 360,
      headingDeg: (i * 47) % 360,
      fovDeg: [60, 75, 90][i % 3],
      rangeM: 25 + (i % 6) * 5,
      sourceType: i === 99 ? SourceType.MOBILE_WEBRTC : SourceType.CCTV_RTSP,
      status: status,
      streamUrl: `rtsp://stream.sentinel.internal:554/live/${cameraCode}`,
      rtspUrl: `rtsp://stream.sentinel.internal:554/live/${cameraCode}`,
      fps: isOffline ? 0 : isDegraded ? 15 : 30,
      peopleCount: isOffline ? 0 : Math.floor(((i * 7) % 25) + 3),
      health: {
        lastSeenAt: new Date(),
        lastFrameAt: new Date(),
        fps: isOffline ? 0 : isDegraded ? 15 : 30,
        bitrate: isOffline ? 0 : isDegraded ? 1024 : 4096,
        packetLoss: isOffline ? 100 : isDegraded ? 8.5 : 0.1,
        latencyMs: isOffline ? 9999 : isDegraded ? 280 : 35,
        reconnects: isDegraded ? 4 : 0,
        uptimePercentage: isOffline ? 84.2 : isDegraded ? 94.6 : 99.9,
      },
      seed: true,
      seedKey: cameraCode,
    };

    await cameraModel.findOneAndUpdate(
      { $or: [{ seedKey: cameraCode }, { id: cameraId }, { cameraCode: cameraCode }] },
      { $set: cameraDoc },
      { upsert: true, new: true },
    );
    cameras.push(cameraDoc);
  }

  return { count: cameras.length, cameras };
}
