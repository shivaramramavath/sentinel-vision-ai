import * as dotenv from 'dotenv';
import * as path from 'path';
import { Kafka } from 'kafkajs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',').map((b) => b.trim());
const clientId = process.env.KAFKA_CLIENT_ID || 'sentinel-api-init';

const TOPIC_SPECS = [
  // Core Data Topics
  { topic: 'video.frames.raw', numPartitions: 3, replicationFactor: 1, retentionMs: '86400000' }, // 24h
  { topic: 'detections.person', numPartitions: 3, replicationFactor: 1, retentionMs: '86400000' }, // 24h
  { topic: 'embeddings.generated', numPartitions: 3, replicationFactor: 1, retentionMs: '604800000' }, // 7d
  { topic: 'search.jobs.commands', numPartitions: 3, replicationFactor: 1, retentionMs: '604800000' }, // 7d
  { topic: 'search.jobs.progress', numPartitions: 3, replicationFactor: 1, retentionMs: '604800000' }, // 7d
  { topic: 'candidates.scored', numPartitions: 3, replicationFactor: 1, retentionMs: '604800000' }, // 7d
  { topic: 'sightings.created', numPartitions: 3, replicationFactor: 1, retentionMs: '2592000000' }, // 30d
  { topic: 'journeys.updated', numPartitions: 3, replicationFactor: 1, retentionMs: '2592000000' }, // 30d
  { topic: 'alerts.created', numPartitions: 3, replicationFactor: 1, retentionMs: '2592000000' }, // 30d

  // Dead Letter Queues (DLQs)
  { topic: 'video.frames.raw.dlq', numPartitions: 1, replicationFactor: 1, retentionMs: '2592000000' },
  { topic: 'detections.person.dlq', numPartitions: 1, replicationFactor: 1, retentionMs: '2592000000' },
  { topic: 'embeddings.generated.dlq', numPartitions: 1, replicationFactor: 1, retentionMs: '2592000000' },
  { topic: 'search.jobs.commands.dlq', numPartitions: 1, replicationFactor: 1, retentionMs: '2592000000' },
  { topic: 'search.jobs.progress.dlq', numPartitions: 1, replicationFactor: 1, retentionMs: '2592000000' },
  { topic: 'candidates.scored.dlq', numPartitions: 1, replicationFactor: 1, retentionMs: '2592000000' },
  { topic: 'sightings.created.dlq', numPartitions: 1, replicationFactor: 1, retentionMs: '2592000000' },
  { topic: 'journeys.updated.dlq', numPartitions: 1, replicationFactor: 1, retentionMs: '2592000000' },
  { topic: 'alerts.created.dlq', numPartitions: 1, replicationFactor: 1, retentionMs: '2592000000' },
];

async function main() {
  console.log(`Connecting to Kafka brokers: ${brokers.join(', ')}...`);
  const kafka = new Kafka({
    clientId,
    brokers,
    connectionTimeout: 5000,
    retry: {
      initialRetryTime: 300,
      retries: 3,
    },
  });

  const admin = kafka.admin();
  try {
    await admin.connect();
    console.log('Connected to Kafka admin client.');

    const existingTopics = await admin.listTopics();
    console.log(`Discovered ${existingTopics.length} existing topics.`);

    const topicsToCreate = TOPIC_SPECS.filter((spec) => !existingTopics.includes(spec.topic)).map((spec) => ({
      topic: spec.topic,
      numPartitions: spec.numPartitions,
      replicationFactor: spec.replicationFactor,
      configEntries: [{ name: 'retention.ms', value: spec.retentionMs }],
    }));

    if (topicsToCreate.length === 0) {
      console.log('All required Kafka topics and DLQs already exist.');
    } else {
      console.log(`Creating ${topicsToCreate.length} missing topics...`);
      const success = await admin.createTopics({
        topics: topicsToCreate,
        waitForLeaders: true,
      });
      if (success) {
        console.log(`Successfully created ${topicsToCreate.length} Kafka topics:`);
        topicsToCreate.forEach((t) => console.log(`  + ${t.topic} (partitions: ${t.numPartitions})`));
      } else {
        console.warn('Some topics may already have been created concurrently.');
      }
    }

    await admin.disconnect();
    console.log('Kafka topic bootstrap completed successfully.');
  } catch (err: any) {
    console.error('Failed to initialize Kafka topics:', err.message);
    process.exit(1);
  }
}

main();
