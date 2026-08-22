import OpenAI from 'openai';

/**
 * Which gateway the assistant talks to, and as which model.
 *
 * OpenCode Zen, on the OpenAI-compatible `/v1/chat/completions`, authenticating
 * with `x-api-key`. That is what Zen actually is: OpenCode's own model registry
 * maps the `opencode` provider to `@ai-sdk/openai-compatible` at this base URL
 * for every model it serves.
 *
 * Zen's docs also describe an Anthropic-compatible `/v1/messages` for the Claude
 * and Qwen families. That path was tried and abandoned: a Zen key alone gets
 * `401 Missing API key` on `claude-haiku-4-5`, because Claude models there are
 * bring-your-own-Anthropic-key. The free tier is only reachable over OpenAI.
 *
 * Verified against Zen on 2026-08-22, with the real system prompt and eight
 * tools. Nine questions: seven with a matching tool, plus "what is the weather
 * in Mumbai" and "how many days was Anil in the office last month", both of
 * which must be declined because no tool covers them and PerformX does not
 * track attendance.
 *
 *   model                   routing   latency
 *   laguna-s-2.1-free       9/9       2.6s/q   <- default
 *   hy3-free                9/9       4.0s/q      fallback
 *   nemotron-3-ultra-free   8/9       5.4s/q      read attendance as leave
 *
 * Re-run it before changing the default. A routing miss reads to the user as
 * the assistant lying, not as a bug, and the two declines are the cases that
 * matter most: the spec makes a wrong refusal a hard gate.
 *
 * Not reachable on a Zen key, checked the same day: minimax-*-free, longcat,
 * ling-3.0-tiny return "not supported", deepseek-v4-flash-free 400s upstream,
 * and claude-haiku-4-5 returns "Missing API key" because Claude on Zen is
 * bring-your-own-Anthropic-key.
 */

export const ZEN_BASE_URL = 'https://opencode.ai/zen/v1';

/**
 * Best free model on Zen for this job: perfect routing in the bench above and
 * the fastest of the models that scored perfectly. Free, so the running cost of
 * the assistant is zero.
 *
 * `ASSISTANT_MODEL` overrides it. Zen takes the bare id; the `opencode/` prefix
 * is an OpenCode config convention, not an API one.
 */
export const DEFAULT_MODEL = 'laguna-s-2.1-free';

export interface AssistantProvider {
  apiKey: string;
  model: string;
  baseURL: string;
}

export interface AssistantEnv {
  OPENCODE_API_KEY?: string;
  OPENCODE_BASE_URL?: string;
  ASSISTANT_MODEL?: string;
}

const set = (value: string | undefined): string | undefined =>
  value && value.trim() !== '' ? value.trim() : undefined;

/**
 * Resolve the gateway at boot, so a missing key kills the process the way
 * `ASSET_ENCRYPTION_KEY` and `JWT_SECRET` do rather than surfacing as an error
 * halfway through a streamed answer.
 *
 * The caller passes the environment rather than this function reading it, for
 * the reason `loadAssetKey` gives: a default parameter meant the missing-key
 * test passed on a laptop and failed in CI, where the workflow sets the
 * variable job wide.
 */
export function resolveProvider(env: AssistantEnv): AssistantProvider {
  const apiKey = set(env.OPENCODE_API_KEY);
  if (!apiKey) {
    throw new Error(
      'OPENCODE_API_KEY is required by the assistant module. Get one at opencode.ai/auth.',
    );
  }

  return {
    apiKey,
    model: set(env.ASSISTANT_MODEL) ?? DEFAULT_MODEL,
    baseURL: set(env.OPENCODE_BASE_URL) ?? ZEN_BASE_URL,
  };
}

/**
 * The gateway client, built once for the process.
 *
 * `AssistantService` is request-scoped, because it reaches services that depend
 * on `DepartmentScopeService` and Nest propagates `Scope.REQUEST` up the whole
 * dependency chain. That is correct for the scope cache and wrong for an HTTP
 * client: without this, every question constructed a new `OpenAI` and threw
 * away its connection pool.
 *
 * Lazy rather than at import time so that a module that only wants
 * `resolveProvider` or `DEFAULT_MODEL`, including the tests, does not need a
 * key in the environment.
 */
let client: OpenAI | undefined;

export function assistantClient(env: AssistantEnv): OpenAI {
  if (!client) {
    const provider = resolveProvider(env);
    client = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseURL,
      // Zen authenticates with x-api-key. The SDK sends Authorization: Bearer,
      // which Zen also accepts, but both are set so a change at either end does
      // not turn into a 401 nobody can place.
      defaultHeaders: { 'x-api-key': provider.apiKey },
    });
  }
  return client;
}
