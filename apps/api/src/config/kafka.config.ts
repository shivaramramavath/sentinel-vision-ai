import { registerAs } from '@nestjs/config';

export const kafkaConfig = registerAs('kafka', () => ({
  brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  clientId: process.env.KAFKA_CLIENT_ID ?? 'sentinel-api',
  groupId: process.env.KAFKA_GROUP_ID ?? 'sentinel-api',
}));
