import { describe, it, expect, vi, beforeAll } from 'vitest';

import { AttachmentsService } from './attachments.service';

// mapAttachments() used to sign every attachment's URL in a plain `for` loop,
// one Supabase Storage round trip at a time. These cover the replacement:
// Promise.all (order preserved regardless of resolution order), a repeated
// storage path signed once per call, and the same fall-back-on-failure and
// empty-list behaviour the loop already had.

type FakeAttachment = {
  id: string;
  task_id: null;
  request_id: null;
  comment_id: null;
  self_action_id: null;
  self_action_comment_id: null;
  file_name: string;
  file_url: string;
  storage_path: string | null;
  file_type: string;
  file_size_kb: number;
  uploaded_by_id: string;
  created_at: Date;
};

function attachment(overrides: Partial<FakeAttachment> = {}): FakeAttachment {
  return {
    id: 'a1',
    task_id: null,
    request_id: null,
    comment_id: null,
    self_action_id: null,
    self_action_comment_id: null,
    file_name: 'file.pdf',
    file_url: 'https://stored.example/file.pdf',
    storage_path: 'tasks/attachments/t1/file.pdf',
    file_type: 'application/pdf',
    file_size_kb: 12,
    uploaded_by_id: 'u1',
    created_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function buildFakeRedis() {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn(async (key: string) => (store.has(key) ? store.get(key) : null)),
    set: vi.fn(async (key: string, value: unknown, _ttlSeconds?: number) => {
      store.set(key, value);
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
}

function buildService(redis: ReturnType<typeof buildFakeRedis> = buildFakeRedis()) {
  // The constructor only builds a Supabase client object (no network call),
  // but it throws without these two set, so tests need real-looking values.
  return new AttachmentsService({} as never, {} as never, redis as never);
}

type PrivateAttachmentsService = {
  mapAttachments: (attachments: FakeAttachment[]) => Promise<{ id: string; file_url: string }[]>;
};

beforeAll(() => {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
});

describe('AttachmentsService.mapAttachments', () => {
  it('returns an empty array for no attachments', async () => {
    const service = buildService();
    const result = await (service as unknown as PrivateAttachmentsService).mapAttachments([]);
    expect(result).toEqual([]);
  });

  it('signs a single attachment', async () => {
    const service = buildService();
    vi.spyOn(service, 'createSignedUrl').mockResolvedValue('https://signed.example/file.pdf');

    const result = await (service as unknown as PrivateAttachmentsService).mapAttachments([attachment()]);

    expect(result).toHaveLength(1);
    expect(result[0]!.file_url).toBe('https://signed.example/file.pdf');
  });

  it('preserves input order regardless of which signing call resolves first', async () => {
    const service = buildService();
    vi.spyOn(service, 'createSignedUrl').mockImplementation(async (path: string) => {
      // The first attachment's signing call is the slow one, so a
      // sequential-looking bug (or a naive unordered concurrent map) would
      // put the second attachment's url in the first slot.
      if (path === 'p1') await new Promise((resolve) => setTimeout(resolve, 10));
      return `signed:${path}`;
    });

    const attachments = [
      attachment({ id: 'a1', storage_path: 'p1' }),
      attachment({ id: 'a2', storage_path: 'p2' }),
    ];
    const result = await (service as unknown as PrivateAttachmentsService).mapAttachments(attachments);

    expect(result.map((r) => r.id)).toEqual(['a1', 'a2']);
    expect(result[0]!.file_url).toBe('signed:p1');
    expect(result[1]!.file_url).toBe('signed:p2');
  });

  it('signs a storage path repeated across attachments only once', async () => {
    const service = buildService();
    const sign = vi.spyOn(service, 'createSignedUrl').mockResolvedValue('signed-once');

    const attachments = [
      attachment({ id: 'a1', storage_path: 'shared-path' }),
      attachment({ id: 'a2', storage_path: 'shared-path' }),
      attachment({ id: 'a3', storage_path: 'other-path' }),
    ];
    await (service as unknown as PrivateAttachmentsService).mapAttachments(attachments);

    expect(sign).toHaveBeenCalledTimes(2);
    expect(sign).toHaveBeenCalledWith('shared-path');
    expect(sign).toHaveBeenCalledWith('other-path');
  });

  it('falls back to the stored URL when signing fails, without throwing', async () => {
    const service = buildService();
    vi.spyOn(service, 'createSignedUrl').mockRejectedValue(new Error('object not found'));

    const attachments = [
      attachment({ id: 'a1', storage_path: 'missing-path', file_url: 'https://fallback.example/file.pdf' }),
    ];
    const result = await (service as unknown as PrivateAttachmentsService).mapAttachments(attachments);

    expect(result[0]!.file_url).toBe('https://fallback.example/file.pdf');
  });

  it('leaves an attachment with no storage_path untouched', async () => {
    const service = buildService();
    const sign = vi.spyOn(service, 'createSignedUrl');

    const attachments = [attachment({ storage_path: null, file_url: 'https://external.example/file.pdf' })];
    const result = await (service as unknown as PrivateAttachmentsService).mapAttachments(attachments);

    expect(sign).not.toHaveBeenCalled();
    expect(result[0]!.file_url).toBe('https://external.example/file.pdf');
  });
});

describe('AttachmentsService signed URL Redis cache', () => {
  it('signs once, then serves the cached URL on a second, later call without hitting Storage again', async () => {
    const redis = buildFakeRedis();
    const service = buildService(redis);
    const sign = vi.spyOn(service, 'createSignedUrl').mockResolvedValue('https://signed.example/file.pdf');

    const first = await (service as unknown as PrivateAttachmentsService).mapAttachments([
      attachment({ id: 'a1', storage_path: 'cached-path' }),
    ]);
    // A second, independent mapAttachments call — a different request, no
    // shared in-memory Map — still gets the cached URL from Redis.
    const second = await (service as unknown as PrivateAttachmentsService).mapAttachments([
      attachment({ id: 'a2', storage_path: 'cached-path' }),
    ]);

    expect(sign).toHaveBeenCalledTimes(1);
    expect(first[0]!.file_url).toBe('https://signed.example/file.pdf');
    expect(second[0]!.file_url).toBe('https://signed.example/file.pdf');
  });

  it('writes the signed URL to Redis with the shared cache key namespace', async () => {
    const redis = buildFakeRedis();
    const service = buildService(redis);
    vi.spyOn(service, 'createSignedUrl').mockResolvedValue('https://signed.example/file.pdf');

    await (service as unknown as PrivateAttachmentsService).mapAttachments([
      attachment({ storage_path: 'some-path' }),
    ]);

    expect(redis.set).toHaveBeenCalledTimes(1);
    const [key, value, ttl] = redis.set.mock.calls[0]!;
    expect(key).toMatch(/^performx:attachment-url:[0-9a-f]{64}$/);
    expect(value).toBe('https://signed.example/file.pdf');
    expect(ttl).toBeLessThan(60 * 60);
  });

  it('still signs correctly when Redis reads fail (falls through as a miss)', async () => {
    const redis = buildFakeRedis();
    redis.get.mockRejectedValue(new Error('redis unavailable'));
    const service = buildService(redis);
    vi.spyOn(service, 'createSignedUrl').mockResolvedValue('https://signed.example/file.pdf');

    // A real RedisService.get() never rejects (it catches internally), but
    // signedUrlFor doesn't lean on that contract — a throwing get() is
    // treated as a miss and Supabase still gets called.
    const result = await (service as unknown as PrivateAttachmentsService).mapAttachments([
      attachment({ storage_path: 'x' }),
    ]);
    expect(result[0]!.file_url).toBe('https://signed.example/file.pdf');
  });

  it('still returns the signed URL when a Redis write fails', async () => {
    const redis = buildFakeRedis();
    redis.set.mockRejectedValue(new Error('redis unavailable'));
    const service = buildService(redis);
    vi.spyOn(service, 'createSignedUrl').mockResolvedValue('https://signed.example/file.pdf');

    const result = await (service as unknown as PrivateAttachmentsService).mapAttachments([
      attachment({ storage_path: 'y' }),
    ]);
    expect(result[0]!.file_url).toBe('https://signed.example/file.pdf');
  });
});
