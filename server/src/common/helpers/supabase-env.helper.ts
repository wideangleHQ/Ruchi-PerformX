/**
 * One reading of the Supabase environment variables, because there were two and
 * they disagreed.
 *
 * Railway holds `SUPABASE_URL` as `https://<ref>.supabase.co/rest/v1/`. That
 * value is correct for PostgREST and wrong for everything else: the storage
 * client appends its own `/storage/v1/...`, the gateway routes the result on the
 * `/rest/v1/` prefix it sees first, and PostgREST answers PGRST125, "Invalid
 * path specified in request URL". The upload fails with a message that names
 * neither storage nor the variable.
 *
 * VisitorService worked around it in its own constructor and AttachmentsService
 * never did, which is why visitor photos uploaded and every task, request and
 * self-action attachment did not. Both read this now.
 *
 * Values are also trimmed and unquoted: an env var pasted with surrounding
 * quotes or a trailing newline is a different failure with the same shape.
 */

const clean = (value: string | undefined): string =>
  (value ?? '').trim().replace(/^["']|["']$/g, '');

/**
 * The project URL with any API path and trailing slashes removed, so the
 * storage, auth and realtime clients can each append their own.
 *
 * Returns an empty string when the variable is unset; callers decide whether
 * that is fatal.
 */
export function supabaseUrlFromEnv(): string {
  return clean(process.env.SUPABASE_URL)
    .replace(/\/(rest|storage|auth|realtime)\/v\d+\/?$/, '')
    .replace(/\/+$/, '');
}

/**
 * The service role key, falling back to the older `SUPABASE_SERVICE_KEY` name
 * that some deployments still set. Empty string when neither is present.
 */
export function supabaseKeyFromEnv(): string {
  return clean(process.env.SUPABASE_SERVICE_ROLE_KEY) || clean(process.env.SUPABASE_SERVICE_KEY);
}

/** A bucket name, trimmed and unquoted, or `fallback` when unset. */
export function supabaseBucketFromEnv(name: string, fallback: string): string {
  return clean(process.env[name]) || fallback;
}
