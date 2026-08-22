/**
 * Validate `ANTHROPIC_API_KEY` at boot.
 *
 * The caller passes `process.env.ANTHROPIC_API_KEY` rather than this function
 * reading it, for the reason `loadAssetKey` gives: a default parameter meant
 * the missing-key test passed on a laptop and failed in CI, where the workflow
 * sets the variable job wide.
 *
 * The SDK would resolve a key from the environment on its own, so this exists
 * only to move the failure from the first question to startup.
 */
export function requireAnthropicKey(raw: string | undefined): string {
  if (!raw || raw.trim() === '') {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is required by the assistant module',
    );
  }
  return raw;
}
