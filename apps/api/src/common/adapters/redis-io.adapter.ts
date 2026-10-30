import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  async connectToRedis(host = 'localhost', port = 6379, password?: string, keyPrefix?: string): Promise<void> {
    try {
      const pubClient = new Redis({
        host,
        port,
        password: password || undefined,
        keyPrefix: keyPrefix ? `${keyPrefix}socket.io:` : undefined,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        retryStrategy: () => null,
      });
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log(`Socket.IO Redis Adapter connected to ${host}:${port} for multi-replica broadcast`);
    } catch (err: any) {
      this.logger.warn(`Redis unavailable for Socket.IO adapter (${err.message}). Using local in-memory adapter.`);
      this.adapterConstructor = null;
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
