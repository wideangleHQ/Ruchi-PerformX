import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * The shared Redis client every module reaches through this service rather
 * than constructing its own — one connection, one place to change retry or
 * TLS behaviour.
 *
 * `REDIS_URL` unset means caching is off, not broken: every method returns
 * a miss/no-op immediately, without ever touching ioredis. That is the
 * intended behaviour, not a fallback to fix — Redis backs a cache here, not
 * a system of record, so its absence must never fail a request that would
 * otherwise succeed. See the 2026-09-19 decision log entry.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly url = process.env.REDIS_URL;
  private client: Redis | null = null;

  onModuleInit(): void {
    if (!this.url) {
      this.logger.warn('REDIS_URL is not set. Caching is disabled; reads fall through to the source of truth.');
      return;
    }

    // enableOfflineQueue: false is load-bearing. Without it, ioredis queues
    // every command in memory while disconnected and replays them on
    // reconnect — unbounded growth under a real outage, and a cache write
    // arriving minutes late is worse than one that never arrived.
    // maxRetriesPerRequest: 1 means a command fails fast instead of
    // blocking an HTTP request on a cache that is still trying to reconnect.
    this.client = new Redis(this.url, {
      lazyConnect: true,
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (attempt) => Math.min(attempt * 200, 2000),
    });

    this.client.on('connect', () => this.logger.log('Redis connection established'));
    this.client.on('close', () => this.logger.warn('Redis connection closed'));
    // ioredis emits 'error' on every failed reconnect attempt; without a
    // listener that is an unhandled error event, which crashes the process.
    // Logging here is what makes the bounded retryStrategy above safe.
    this.client.on('error', (error) => this.logger.warn(`Redis connection error: ${error.message}`));

    this.client.connect().catch((error: Error) => {
      this.logger.warn(`Redis initial connection failed, will keep retrying in the background: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    await this.client.quit().catch(() => this.client?.disconnect());
  }

  /**
   * Reads a JSON value previously written with `set`. Null on a miss, on a
   * malformed cached value, or on any Redis failure — a cache read must
   * never be the reason a request fails.
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const raw = await this.client.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(`Redis GET failed for key ${key}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Writes a JSON value with a TTL. Failure is logged and swallowed: the
   * caller already has the correct value from the source of truth, and a
   * missed cache write only costs the next reader a recompute.
   */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(`Redis SET failed for key ${key}: ${(error as Error).message}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.warn(`Redis DEL failed for key ${key}: ${(error as Error).message}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      return (await this.client.exists(key)) > 0;
    } catch (error) {
      this.logger.warn(`Redis EXISTS failed for key ${key}: ${(error as Error).message}`);
      return false;
    }
  }
}
