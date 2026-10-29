import { Model } from 'mongoose';
import { CameraTopologyDocument } from '../cameras/schemas/camera-topology.schema';

export async function seedTopology(
  topologyModel: Model<CameraTopologyDocument>,
  options: { reset?: boolean } = {},
) {
  if (options.reset) {
    await topologyModel.deleteMany({ seed: true });
  }

  const transitions = [];

  // Connect adjacent cameras within zones and across primary concourses
  for (let i = 1; i <= 123; i++) {
    const fromCam = `CAM-${String(i).padStart(3, '0')}`;
    const toCam = `CAM-${String(i + 1).padStart(3, '0')}`;
    const distanceMeters = 40 + ((i * 13) % 90);
    const minTravelSec = Math.round(distanceMeters / 1.6);
    const maxTravelSec = Math.round(distanceMeters / 0.8) + 30;

    const doc = {
      fromCamera: fromCam,
      toCamera: toCam,
      distanceMeters,
      minTravelSec,
      maxTravelSec,
      transitionProb: 0.85,
      distributionType: 'lognormal',
      seed: true,
      seedKey: `${fromCam}->${toCam}`,
    };

    await topologyModel.findOneAndUpdate(
      { fromCamera: fromCam, toCamera: toCam },
      { $set: doc },
      { upsert: true, new: true },
    );
    transitions.push(doc);

    // Two-way reverse transition
    const reverseDoc = {
      fromCamera: toCam,
      toCamera: fromCam,
      distanceMeters,
      minTravelSec,
      maxTravelSec,
      transitionProb: 0.85,
      distributionType: 'lognormal',
      seed: true,
      seedKey: `${toCam}->${fromCam}`,
    };

    await topologyModel.findOneAndUpdate(
      { fromCamera: toCam, toCamera: fromCam },
      { $set: reverseDoc },
      { upsert: true, new: true },
    );
    transitions.push(reverseDoc);
  }

  return { count: transitions.length };
}
