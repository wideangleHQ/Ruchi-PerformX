import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// No approved Redis instance is available in this environment (see the
// Phase 3 roadmap entry), so the REDIS_URL-set path is covered against a
// mocked ioredis client rather than a live one. The REDIS_URL-unset path
// needs no mock: it is real production behaviour with nothing to fake.
const hoisted = vi.hoisted(() => ({ instances: [] as MockRedis[], connectShouldReject: false }));

class MockRedis {
  handlers: Record<string, (...args: unknown[]) => void> = {};
  connect = vi.fn(() =>
    hoisted.connectShouldReject ? Promise.reject(new Error('ECONNREFUSED')) : Promise.resolve(undefined),
  );
  quit = vi.fn().mockResolvedValue(undefined);
  disconnect = vi.fn();
  get = vi.fn();
  set = vi.fn();
  del = vi.fn();
  exists = vi.fn();

  constructor(
    public url: string,
    public options: Record<string, unknown>,
  ) {
    hoisted.instances.push(this);
  }

  on(event: string, handler: (...args: unknown[]) => void) {
    this.handlers[event] = handler;
    return this;
  }
}

vi.mock('ioredis', () => ({ default: MockRedis }));

async function importRedisService() {
  const module = await import('./redis.service.js');
  return module.RedisService;
}

describe('RedisService — REDIS_URL not set', () => {
  beforeEach(() => {
    vi.stubEnv('REDIS_URL', '');
    delete process.env.REDIS_URL;
    hoisted.instances.length = 0;
    vi.resetModules();
  });

  it('never constructs an ioredis client', async () => {
    const RedisService = await importRedisService();
    const service = new RedisService();
    service.onModuleInit();

    expect(hoisted.instances).toHaveLength(0);
  });

  it('get/set/del/exists all no-op instead of throwing', async () => {
    const RedisService = await importRedisService();
    const service = new RedisService();
    service.onModuleInit();

    await expect(service.get('k')).resolves.toBeNull();
    await expect(service.set('k', { a: 1 }, 60)).resolves.toBeUndefined();
    await expect(service.del('k')).resolves.toBeUndefined();
    await expect(service.exists('k')).resolves.toBe(false);
  });

  it('onModuleDestroy is a no-op when there was never a client', async () => {
    const RedisService = await importRedisService();
    const service = new RedisService();
    service.onModuleInit();

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});

describe('RedisService — REDIS_URL set (mocked ioredis)', () => {
  beforeEach(() => {
    vi.stubEnv('REDIS_URL', 'rediss://user:pass@example-redis-host:6380');
    hoisted.instances.length = 0;
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('configures a bounded, fail-fast client — no offline queue, one retry per request', async () => {
    const RedisService = await importRedisService();
    const service = new RedisService();
    service.onModuleInit();

    const client = hoisted.instances[0]!;
    expect(client.url).toBe('rediss://user:pass@example-redis-host:6380');
    expect(client.options).toMatchObject({
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    expect(client.connect).toHaveBeenCalledTimes(1);
  });

  it('round-trips a JSON value through set then get', async () => {
    const RedisService = await importRedisService();
    const service = new RedisService();
    service.onModuleInit();
    const client = hoisted.instances[0]!;

    let stored: string | null = null;
    client.set.mockImplementation(async (_key: string, value: string) => {
      stored = value;
      return 'OK';
    });
    client.get.mockImplementation(async () => stored);

    await service.set('performx:example', { a: 1, b: [2, 3] }, 120);
    expect(client.set).toHaveBeenCalledWith('performx:example', JSON.stringify({ a: 1, b: [2, 3] }), 'EX', 120);

    const result = await service.get<{ a: number; b: number[] }>('performx:example');
    expect(result).toEqual({ a: 1, b: [2, 3] });
  });

  it('returns null on a missing key', async () => {
    const RedisService = await importRedisService();
    const service = new RedisService();
    service.onModuleInit();
    hoisted.instances[0]!.get.mockResolvedValue(null);

    await expect(service.get('performx:missing')).resolves.toBeNull();
  });

  it('returns null rather than throwing on a malformed cached value', async () => {
    const RedisService = await importRedisService();
    const service = new RedisService();
    service.onModuleInit();
    hoisted.instances[0]!.get.mockResolvedValue('{not valid json');

    await expect(service.get('performx:bad')).resolves.toBeNull();
  });

  it('get() swallows a client error and returns null', async () => {
    const RedisService = await importRedisService();
    const service = new RedisService();
    service.onModuleInit();
    hoisted.instances[0]!.get.mockRejectedValue(new Error('connection reset'));

    await expect(service.get('performx:x')).resolves.toBeNull();
  });

  it('set() swallows a client error rather than throwing', async () => {
    const RedisService = await importRedisService();
    const service = new RedisService();
    service.onModuleInit();
    hoisted.instances[0]!.set.mockRejectedValue(new Error('connection reset'));

    await expect(service.set('performx:x', 'v', 60)).resolves.toBeUndefined();
  });

  it('del() and exists() swallow client errors too', async () => {
    const RedisService = await importRedisService();
    const service = new RedisService();
    service.onModuleInit();
    const client = hoisted.instances[0]!;
    client.del.mockRejectedValue(new Error('down'));
    client.exists.mockRejectedValue(new Error('down'));

    await expect(service.del('performx:x')).resolves.toBeUndefined();
    await expect(service.exists('performx:x')).resolves.toBe(false);
  });

  it('exists() reflects the ioredis integer result as a boolean', async () => {
    const RedisService = await importRedisService();
    const service = new RedisService();
    service.onModuleInit();
    const client = hoisted.instances[0]!;

    client.exists.mockResolvedValueOnce(1);
    await expect(service.exists('performx:present')).resolves.toBe(true);

    client.exists.mockResolvedValueOnce(0);
    await expect(service.exists('performx:absent')).resolves.toBe(false);
  });

  it('quits the client on module destroy', async () => {
    const RedisService = await importRedisService();
    const service = new RedisService();
    service.onModuleInit();
    const client = hoisted.instances[0]!;

    await service.onModuleDestroy();
    expect(client.quit).toHaveBeenCalledTimes(1);
  });

  it('does not throw if the initial connect() rejects — it logs and lets ioredis keep retrying', async () => {
    hoisted.connectShouldReject = true;
    const RedisService = await importRedisService();
    const service = new RedisService();

    expect(() => service.onModuleInit()).not.toThrow();
    // Let the rejected connect() promise's .catch() handler run.
    await new Promise((resolve) => setTimeout(resolve, 0));

    hoisted.connectShouldReject = false;
  });
});
