import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface TokenFamilyData {
  tokenHash: string;
  userId: string;
  role: string;
  createdAt: number;
}

interface InMemoryBucket {
  tokens: number;
  lastRefilled: number;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  // In-memory fallback structures
  private readonly memStorage = new Map<string, { value: string; expiresAt?: number }>();
  private readonly memBuckets = new Map<string, InMemoryBucket>();
  private readonly memGeo = new Map<string, Map<string, { longitude: number; latitude: number }>>();

  constructor(private readonly configService: ConfigService) {}

  getClient(): Redis | null {
    return this.client;
  }

  isHealthy(): boolean {
    return this.isConnected;
  }

  async onModuleInit(): Promise<void> {
    const host = this.configService.get<string>('redis.host') || this.configService.get<string>('app.redisHost', 'localhost');
    const port = this.configService.get<number>('redis.port') || this.configService.get<number>('app.redisPort', 6379);
    const password = this.configService.get<string>('redis.password');
    const db = this.configService.get<number>('redis.db', 0);
    const keyPrefix = this.configService.get<string>('redis.keyPrefix', 'sentinel:');

    try {
      this.client = new Redis({
        host,
        port,
        password: password || undefined,
        db,
        keyPrefix,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        retryStrategy: (times) => Math.min(times * 200, 3000),
        lazyConnect: true,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log(`Connected to Redis at ${host}:${port} (db: ${db}, keyPrefix: ${keyPrefix})`);
      });

      this.client.on('error', (err) => {
        if (this.isConnected) {
          this.logger.warn(`Redis connection error: ${err.message}`);
        }
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (err: any) {
      this.logger.warn(
        `Redis unavailable at ${host}:${port} (${err.message}). Using resilient in-memory fallback.`,
      );
      this.isConnected = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        // ignore disconnect errors
      }
    }
  }

  // Idempotency: SETNX with TTL
  async setnx(key: string, value: string, ttlSec: number): Promise<boolean> {
    if (this.isConnected && this.client) {
      const res = await this.client.set(key, value, 'EX', ttlSec, 'NX');
      return res === 'OK';
    }

    const now = Date.now();
    const existing = this.memStorage.get(key);
    if (existing && (!existing.expiresAt || existing.expiresAt > now)) {
      return false; // key already exists
    }

    this.memStorage.set(key, {
      value,
      expiresAt: ttlSec > 0 ? now + ttlSec * 1000 : undefined,
    });
    return true;
  }

  // Refresh Token Family Management (Family Rotation & Reuse Detection)
  async storeFamily(
    familyId: string,
    tokenHash: string,
    userId: string,
    role: string,
    ttlSec = 7 * 24 * 3600,
  ): Promise<void> {
    const key = `auth:family:${familyId}`;
    const payload: TokenFamilyData = {
      tokenHash,
      userId,
      role,
      createdAt: Date.now(),
    };
    const serialized = JSON.stringify(payload);

    if (this.isConnected && this.client) {
      await this.client.set(key, serialized, 'EX', ttlSec);
      return;
    }

    this.memStorage.set(key, {
      value: serialized,
      expiresAt: Date.now() + ttlSec * 1000,
    });
  }

  async getFamily(familyId: string): Promise<TokenFamilyData | null> {
    const key = `auth:family:${familyId}`;

    if (this.isConnected && this.client) {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    }

    const item = this.memStorage.get(key);
    if (!item) return null;
    if (item.expiresAt && item.expiresAt <= Date.now()) {
      this.memStorage.delete(key);
      return null;
    }
    return JSON.parse(item.value);
  }

  async updateFamily(
    familyId: string,
    newTokenHash: string,
    ttlSec = 7 * 24 * 3600,
  ): Promise<void> {
    const existing = await this.getFamily(familyId);
    if (!existing) return;

    existing.tokenHash = newTokenHash;
    const key = `auth:family:${familyId}`;
    const serialized = JSON.stringify(existing);

    if (this.isConnected && this.client) {
      await this.client.set(key, serialized, 'EX', ttlSec);
      return;
    }

    this.memStorage.set(key, {
      value: serialized,
      expiresAt: Date.now() + ttlSec * 1000,
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    const key = `auth:family:${familyId}`;
    this.logger.warn(`Revoking refresh token family: ${familyId}`);

    if (this.isConnected && this.client) {
      await this.client.del(key);
      return;
    }

    this.memStorage.delete(key);
  }

  // Generic Cache Methods (Used for GeoJSON & Map layers)
  async get(key: string): Promise<string | null> {
    if (this.isConnected && this.client) {
      try {
        return await this.client.get(key);
      } catch (err: any) {
        this.logger.warn(`Redis get error (${key}): ${err.message}`);
      }
    }
    const item = this.memStorage.get(key);
    if (!item) return null;
    if (item.expiresAt && item.expiresAt <= Date.now()) {
      this.memStorage.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ttlSec?: number): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        if (ttlSec) {
          await this.client.set(key, value, 'EX', ttlSec);
        } else {
          await this.client.set(key, value);
        }
        return;
      } catch (err: any) {
        this.logger.warn(`Redis set error (${key}): ${err.message}`);
      }
    }
    this.memStorage.set(key, {
      value,
      expiresAt: ttlSec ? Date.now() + ttlSec * 1000 : undefined,
    });
  }

  async del(key: string): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
        return;
      } catch (err: any) {
        this.logger.warn(`Redis del error (${key}): ${err.message}`);
      }
    }
    this.memStorage.delete(key);
  }

  async incr(key: string): Promise<number> {
    if (this.isConnected && this.client) {
      try {
        return await this.client.incr(key);
      } catch (err: any) {
        this.logger.warn(`Redis incr error (${key}): ${err.message}`);
      }
    }
    const current = parseInt(this.memStorage.get(key)?.value || '0', 10);
    const next = current + 1;
    this.memStorage.set(key, { value: String(next) });
    return next;
  }

  async delByPattern(pattern: string): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
        return;
      } catch (err: any) {
        this.logger.warn(`Redis delByPattern error (${pattern}): ${err.message}`);
      }
    }
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const k of Array.from(this.memStorage.keys())) {
      if (regex.test(k)) {
        this.memStorage.delete(k);
      }
    }
  }

  async publish(channel: string, message: string): Promise<number> {
    if (this.isConnected && this.client) {
      try {
        return await this.client.publish(channel, message);
      } catch (err: any) {
        this.logger.warn(`Redis publish error (${channel}): ${err.message}`);
      }
    }
    return 0;
  }

  // Token-Bucket Rate Limiter
  // maxTokens: bucket capacity; refillIntervalMs: interval to add 1 token (or interval for full refill)
  async consumeRateLimitToken(
    key: string,
    maxTokens = 5,
    refillIntervalMs = 60000,
  ): Promise<{ allowed: boolean; remaining: number }> {
    const redisKey = `ratelimit:${key}`;
    const now = Date.now();

    if (this.isConnected && this.client) {
      // Redis Lua script or string manipulation
      const raw = await this.client.get(redisKey);
      let bucket: InMemoryBucket = raw ? JSON.parse(raw) : { tokens: maxTokens, lastRefilled: now };

      const timePassed = now - bucket.lastRefilled;
      const tokensToAdd = Math.floor((timePassed / refillIntervalMs) * maxTokens);
      bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefilled = now;

      if (bucket.tokens > 0) {
        bucket.tokens -= 1;
        await this.client.set(redisKey, JSON.stringify(bucket), 'PX', refillIntervalMs * 2);
        return { allowed: true, remaining: bucket.tokens };
      }

      await this.client.set(redisKey, JSON.stringify(bucket), 'PX', refillIntervalMs * 2);
      return { allowed: false, remaining: 0 };
    }

    // In-memory fallback
    let bucket = this.memBuckets.get(redisKey);
    if (!bucket) {
      bucket = { tokens: maxTokens, lastRefilled: now };
      this.memBuckets.set(redisKey, bucket);
    }

    const timePassed = now - bucket.lastRefilled;
    const tokensToAdd = Math.floor((timePassed / refillIntervalMs) * maxTokens);
    bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefilled = now;

    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
      return { allowed: true, remaining: bucket.tokens };
    }

    return { allowed: false, remaining: 0 };
  }

  // =========================================================================
  // Redis GEO Methods (GEOADD / GEOSEARCH) with resilient In-Memory fallback
  // =========================================================================

  /**
   * Adds or updates a geospatial member [longitude, latitude] into a Redis key.
   */
  async geoAdd(
    key: string,
    longitude: number,
    latitude: number,
    member: string,
  ): Promise<number> {
    if (this.isConnected && this.client) {
      try {
        return await this.client.geoadd(key, longitude, latitude, member);
      } catch (err: any) {
        this.logger.warn(`Redis geoadd error (${key}, ${member}): ${err.message}`);
      }
    }

    // In-memory fallback
    let map = this.memGeo.get(key);
    if (!map) {
      map = new Map();
      this.memGeo.set(key, map);
    }
    const isNew = !map.has(member);
    map.set(member, { longitude, latitude });
    return isNew ? 1 : 0;
  }

  /**
   * Searches members within radiusMeters from [longitude, latitude] using Redis GEOSEARCH.
   * Returns members ordered by ascending distance.
   */
  async geoSearch(
    key: string,
    longitude: number,
    latitude: number,
    radiusMeters: number,
    count?: number,
  ): Promise<Array<{ member: string; distance: number; coordinates?: [number, number] }>> {
    if (this.isConnected && this.client) {
      try {
        // Redis 6.2+ GEOSEARCH command with fallback to GEORADIUS
        const args: (string | number)[] = [
          key,
          'FROMLONLAT',
          longitude,
          latitude,
          'BYRADIUS',
          radiusMeters,
          'm',
          'WITHDIST',
          'WITHCOORD',
          'ASC',
        ];
        if (count && count > 0) {
          args.push('COUNT', count);
        }

        const raw = (await this.client.call('GEOSEARCH', ...args)) as any[];
        if (Array.isArray(raw)) {
          return raw.map(([m, dist, coords]: any) => ({
            member: String(m),
            distance: typeof dist === 'string' ? parseFloat(dist) : Number(dist),
            coordinates:
              Array.isArray(coords) && coords.length >= 2
                ? [parseFloat(coords[0]), parseFloat(coords[1])]
                : undefined,
          }));
        }
      } catch (err: any) {
        // Fallback to GEORADIUS if server does not support GEOSEARCH
        try {
          const radiusArgs: (string | number)[] = [
            key,
            longitude,
            latitude,
            radiusMeters,
            'm',
            'WITHDIST',
            'WITHCOORD',
            'ASC',
          ];
          if (count && count > 0) {
            radiusArgs.push('COUNT', count);
          }
          const rawRadius = (await this.client.call('GEORADIUS', ...radiusArgs)) as any[];
          if (Array.isArray(rawRadius)) {
            return rawRadius.map(([m, dist, coords]: any) => ({
              member: String(m),
              distance: typeof dist === 'string' ? parseFloat(dist) : Number(dist),
              coordinates:
                Array.isArray(coords) && coords.length >= 2
                  ? [parseFloat(coords[0]), parseFloat(coords[1])]
                  : undefined,
            }));
          }
        } catch (innerErr: any) {
          this.logger.warn(`Redis GEOSEARCH fallback error (${key}): ${innerErr.message}`);
        }
      }
    }

    // In-memory Haversine fallback
    const map = this.memGeo.get(key);
    if (!map) return [];

    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371000; // Earth radius in meters
    const results: Array<{ member: string; distance: number; coordinates: [number, number] }> = [];

    for (const [member, pos] of map.entries()) {
      const dLat = toRad(pos.latitude - latitude);
      const dLon = toRad(pos.longitude - longitude);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(latitude)) *
          Math.cos(toRad(pos.latitude)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = Math.round(R * c);

      if (distance <= radiusMeters) {
        results.push({
          member,
          distance,
          coordinates: [pos.longitude, pos.latitude],
        });
      }
    }

    results.sort((a, b) => a.distance - b.distance);
    return count && count > 0 ? results.slice(0, count) : results;
  }

  /**
   * Retrieves [longitude, latitude] coordinates for member IDs from a Redis GEO key.
   */
  async geoPos(key: string, ...members: string[]): Promise<Array<[number, number] | null>> {
    if (members.length === 0) return [];

    if (this.isConnected && this.client) {
      try {
        const raw = (await this.client.geopos(key, ...members)) as Array<[string, string] | null>;
        if (Array.isArray(raw)) {
          return raw.map((pos) =>
            pos ? [parseFloat(pos[0]), parseFloat(pos[1])] : null,
          );
        }
      } catch (err: any) {
        this.logger.warn(`Redis geopos error (${key}): ${err.message}`);
      }
    }

    const map = this.memGeo.get(key);
    return members.map((m) => {
      const pos = map?.get(m);
      return pos ? [pos.longitude, pos.latitude] : null;
    });
  }
}
