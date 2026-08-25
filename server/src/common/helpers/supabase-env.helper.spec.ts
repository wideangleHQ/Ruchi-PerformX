import { describe, it, expect, afterEach } from 'vitest';
import {
  supabaseBucketFromEnv,
  supabaseKeyFromEnv,
  supabaseUrlFromEnv,
} from './supabase-env.helper';

/**
 * The value on Railway is `https://<ref>.supabase.co/rest/v1/`, which is right
 * for PostgREST and wrong for storage. The storage client appends its own
 * `/storage/v1/object/...`, the gateway routes the whole thing on the
 * `/rest/v1/` it sees first, and PostgREST answers PGRST125, "Invalid path
 * specified in request URL".
 *
 * That reached production as a 400 on every attachment, on a message that names
 * neither storage nor the variable, and stayed there because VisitorService
 * stripped the path in its own constructor and AttachmentsService did not.
 *
 * Every case below was run against the live project before it was written here.
 * The bare URL uploads; each path-suffixed one fails, and `/rest/v1` fails with
 * the exact production string.
 */

const BARE = 'https://wxihzurmvuwqwbmddvkz.supabase.co';

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
});

function urlFrom(value: string | undefined) {
  if (value === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = value;
  return supabaseUrlFromEnv();
}

describe('supabaseUrlFromEnv', () => {
  it('strips the /rest/v1 that production actually has', () => {
    expect(urlFrom(`${BARE}/rest/v1/`)).toBe(BARE);
    expect(urlFrom(`${BARE}/rest/v1`)).toBe(BARE);
  });

  it('strips the other service paths too, so no one finds this again sideways', () => {
    expect(urlFrom(`${BARE}/storage/v1`)).toBe(BARE);
    expect(urlFrom(`${BARE}/auth/v1/`)).toBe(BARE);
    expect(urlFrom(`${BARE}/realtime/v1`)).toBe(BARE);
  });

  it('leaves a bare URL alone', () => {
    expect(urlFrom(BARE)).toBe(BARE);
  });

  it('drops trailing slashes, quotes and whitespace', () => {
    expect(urlFrom(`${BARE}//`)).toBe(BARE);
    expect(urlFrom(`"${BARE}"`)).toBe(BARE);
    expect(urlFrom(`  ${BARE}\n`)).toBe(BARE);
    expect(urlFrom(`'${BARE}/rest/v1/'`)).toBe(BARE);
  });

  it('does not eat a path that is not a service prefix', () => {
    expect(urlFrom('https://self-hosted.example.com/supabase')).toBe('https://self-hosted.example.com/supabase');
  });

  it('returns empty when unset, so the caller can decide', () => {
    expect(urlFrom(undefined)).toBe('');
  });
});

describe('supabaseKeyFromEnv', () => {
  it('prefers the service role key', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'role-key';
    process.env.SUPABASE_SERVICE_KEY = 'older-key';
    expect(supabaseKeyFromEnv()).toBe('role-key');
  });

  it('falls back to the older name some deployments still set', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_SERVICE_KEY = 'older-key';
    expect(supabaseKeyFromEnv()).toBe('older-key');
  });

  it('unquotes and trims', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = '  "role-key"  ';
    expect(supabaseKeyFromEnv()).toBe('role-key');
  });
});

describe('supabaseBucketFromEnv', () => {
  it('unquotes, so .from() is not handed a name with quotes in it', () => {
    process.env.SUPABASE_BUCKET = '"performx-files"';
    expect(supabaseBucketFromEnv('SUPABASE_BUCKET', 'fallback')).toBe('performx-files');
  });

  it('trims, because a trailing newline reads as a different bucket', () => {
    process.env.SUPABASE_BUCKET = 'performx-files\n';
    expect(supabaseBucketFromEnv('SUPABASE_BUCKET', 'fallback')).toBe('performx-files');
  });

  it('falls back when unset', () => {
    delete process.env.SUPABASE_BUCKET;
    expect(supabaseBucketFromEnv('SUPABASE_BUCKET', 'performx-files')).toBe('performx-files');
  });
});
