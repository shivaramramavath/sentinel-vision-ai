import { ConfigType } from '@nestjs/config';

import { serverConfig } from './server.config';
import { authConfig } from './auth.config';
import { oauthConfig } from './oauth.config';
import { emailConfig } from './email.config';
import { mongoConfig } from './mongo.config';
import { redisConfig } from './redis.config';
import { kafkaConfig } from './kafka.config';
import { pineconeConfig } from './pinecone.config';
import { storageConfig } from './storage.config';
import { mediaConfig } from './media.config';
import { adminConfig } from './admin.config';
import appConfig from './app.config';

export {
  serverConfig,
  authConfig,
  oauthConfig,
  emailConfig,
  mongoConfig,
  redisConfig,
  kafkaConfig,
  pineconeConfig,
  storageConfig,
  mediaConfig,
  adminConfig,
  appConfig,
};

export type ServerConfig = ConfigType<typeof serverConfig>;
export type AuthConfig = ConfigType<typeof authConfig>;
export type OAuthConfig = ConfigType<typeof oauthConfig>;
export type EmailConfig = ConfigType<typeof emailConfig>;
export type MongoConfig = ConfigType<typeof mongoConfig>;
export type RedisConfig = ConfigType<typeof redisConfig>;
export type KafkaConfig = ConfigType<typeof kafkaConfig>;
export type PineconeConfig = ConfigType<typeof pineconeConfig>;
export type StorageConfig = ConfigType<typeof storageConfig>;
export type MediaConfig = ConfigType<typeof mediaConfig>;
export type AdminConfig = ConfigType<typeof adminConfig>;
export type AppConfig = ConfigType<typeof appConfig>;

export const allConfigs = [
  serverConfig,
  authConfig,
  oauthConfig,
  emailConfig,
  mongoConfig,
  redisConfig,
  kafkaConfig,
  pineconeConfig,
  storageConfig,
  mediaConfig,
  adminConfig,
  appConfig,
];
