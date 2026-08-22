/**
 * Which gateway the assistant talks to, and as which model.
 *
 * OpenCode Zen serves an Anthropic-compatible `/v1/messages` and authenticates
 * with `x-api-key`, which is exactly what `@anthropic-ai/sdk` already sends. So
 * pointing the existing client at Zen is a base URL and a key, and the tool
 * loop, the streaming, the cache breakpoint and every type stay as they are.
 * There was no Anthropic-specific code to replace.
 *
 * That equivalence holds for the Claude and Qwen families only. Zen puts
 * MiniMax, GLM, Kimi, DeepSeek and the free tier behind `/v1/chat/completions`
 * in OpenAI format, which is a different tool-call shape and a different loop.
 * `assertSupportedModel` refuses those rather than letting the SDK send an
 * Anthropic body to an OpenAI endpoint and fail at runtime with something
 * unhelpful.
 *
 * Resolution order, first match wins:
 *
 *   OPENCODE_API_KEY  -> Zen        https://opencode.ai/zen/v1
 *   ANTHROPIC_API_KEY -> Anthropic  the SDK default
 *
 * so a deployment moves between them by which key is set, with no code change.
 * `ASSISTANT_MODEL` overrides the model on either.
 */

export const ZEN_BASE_URL = 'https://opencode.ai/zen/v1';

/**
 * Default on both gateways. Cheap, fast, and a fixed catalog of about thirty
 * tools is well inside its routing range. Zen takes the bare id; the
 * `opencode/` prefix is an OpenCode config convention, not an API one.
 */
export const DEFAULT_MODEL = 'claude-haiku-4-5';

/**
 * Families Zen serves over the Anthropic-compatible `/messages` path. Anything
 * else needs an OpenAI-shaped client, which this module does not have.
 */
const ANTHROPIC_COMPATIBLE = /^(claude-|qwen)/i;

export interface AssistantProvider {
  name: 'opencode-zen' | 'anthropic';
  apiKey: string;
  model: string;
  /** Left undefined for direct Anthropic so the SDK uses its own default. */
  baseURL?: string;
}

export interface AssistantEnv {
  OPENCODE_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  ASSISTANT_MODEL?: string;
}

const set = (value: string | undefined): string | undefined =>
  value && value.trim() !== '' ? value.trim() : undefined;

/**
 * Refuse a model this module cannot actually speak to.
 *
 * The failure this prevents is quiet: the SDK would post an Anthropic body to
 * `/messages`, Zen would route a MiniMax request it cannot parse, and the first
 * anyone hears of it is a 400 in the middle of a streamed answer.
 */
export function assertSupportedModel(model: string): string {
  if (!ANTHROPIC_COMPATIBLE.test(model)) {
    throw new Error(
      `ASSISTANT_MODEL "${model}" is not on an Anthropic-compatible endpoint. ` +
        'OpenCode Zen serves the Claude and Qwen families over /v1/messages, ' +
        'which is the protocol this module speaks. MiniMax, GLM, Kimi, DeepSeek ' +
        'and the free tier are OpenAI-shaped on /v1/chat/completions and need a ' +
        'different client and a different tool loop.',
    );
  }
  return model;
}

/**
 * Resolve the gateway at boot, so a missing key kills the process the way
 * `ASSET_ENCRYPTION_KEY` and `JWT_SECRET` do rather than surfacing as a 500
 * halfway through an answer.
 *
 * The caller passes the environment rather than this function reading it, for
 * the reason `loadAssetKey` gives: a default parameter meant the missing-key
 * test passed on a laptop and failed in CI, where the workflow sets the
 * variable job wide.
 */
export function resolveProvider(env: AssistantEnv): AssistantProvider {
  const model = assertSupportedModel(set(env.ASSISTANT_MODEL) ?? DEFAULT_MODEL);

  const zenKey = set(env.OPENCODE_API_KEY);
  if (zenKey) {
    return {
      name: 'opencode-zen',
      apiKey: zenKey,
      model,
      baseURL: ZEN_BASE_URL,
    };
  }

  const anthropicKey = set(env.ANTHROPIC_API_KEY);
  if (anthropicKey) {
    return { name: 'anthropic', apiKey: anthropicKey, model };
  }

  throw new Error(
    'The assistant needs a key. Set OPENCODE_API_KEY to go through OpenCode Zen, ' +
      'or ANTHROPIC_API_KEY to call Anthropic directly.',
  );
}
