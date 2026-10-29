/**
 * Script to pre-create Kafka topics for Sentinel Vision AI.
 * Run once after Kafka is up: `ts-node infra/scripts/setup-kafka-topics.ts`
 */
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'sentinel-admin',
  brokers: [process.env.KAFKA_BROKERS ?? 'localhost:9092'],
});

const admin = kafka.admin();

const TOPICS = [
  { topic: 'frames.raw', numPartitions: 4, replicationFactor: 1 },
  { topic: 'detections.person', numPartitions: 4, replicationFactor: 1 },
  { topic: 'embeddings.face', numPartitions: 2, replicationFactor: 1 },
  { topic: 'embeddings.reid', numPartitions: 2, replicationFactor: 1 },
  { topic: 'sightings.created', numPartitions: 2, replicationFactor: 1 },
  { topic: 'alerts.dispatch', numPartitions: 1, replicationFactor: 1 },
];

async function run() {
  await admin.connect();
  console.log('Connected to Kafka');

  await admin.createTopics({
    waitForLeaders: true,
    topics: TOPICS,
  });

  const existing = await admin.listTopics();
  console.log('Topics:', existing.filter((t) => !t.startsWith('__')));

  await admin.disconnect();
  console.log('Done');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
