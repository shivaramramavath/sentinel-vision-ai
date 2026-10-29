import { z } from 'zod';

/**
 * Standard Event Topics for Sentinel Vision AI.
 * Partition key for video and tracking streams is strictly `cameraId`
 * to guarantee in-order delivery per camera.
 */
export const EventTopics = {
  SEARCH_JOBS_COMMANDS: 'search.jobs.commands',
  SEARCH_JOBS_PROGRESS: 'search.jobs.progress',
  VIDEO_FRAMES_RAW: 'video.frames.raw',
  DETECTIONS_PERSON: 'detections.person',
  EMBEDDINGS_GENERATED: 'embeddings.generated',
  CANDIDATES_SCORED: 'candidates.scored',
  SIGHTINGS_CREATED: 'sightings.created',
  JOURNEYS_UPDATED: 'journeys.updated',
  ALERTS_CREATED: 'alerts.created',
} as const;

export type EventTopic = (typeof EventTopics)[keyof typeof EventTopics];

/**
 * Helper to resolve DLQ topic name for any base topic.
 * Policy: topicName + '.dlq'
 */
export function getDlqTopic(topic: string): string {
  return `${topic}.dlq`;
}

/**
 * All active topic names including their DLQs.
 */
export const ALL_ACTIVE_TOPICS: string[] = [
  ...Object.values(EventTopics),
  ...Object.values(EventTopics).map((t) => getDlqTopic(t)),
];
