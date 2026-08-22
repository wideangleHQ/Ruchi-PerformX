import axiosClient from './client';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export type AssistantEvent =
  | { type: 'text'; text: string }
  /** Discard the answer streamed so far. The model narrated its way into a
   * tool call ("I'll check the leave calendar...") and that is not the answer. */
  | { type: 'reset' }
  | { type: 'tool'; name: string }
  | { type: 'done'; exchangeId: string; toolsUsed: string[]; declined: boolean }
  | { type: 'error'; message: string };

export interface AssistantTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskOptions {
  conversationId: string;
  question: string;
  history: AssistantTurn[];
  pageContext?: string;
  signal?: AbortSignal;
}

/**
 * Ask the assistant, yielding events as they stream in.
 *
 * ponytail: raw `fetch` rather than the shared axios client, because XHR
 * buffers the whole body and the point of this endpoint is that it does not
 * wait. The token is read the same way the axios interceptor reads it, so both
 * paths break together if that ever moves off localStorage.
 */
export async function* ask(options: AskOptions): AsyncGenerator<AssistantEvent> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const response = await fetch(`${API_URL}/assistant/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      conversation_id: options.conversationId,
      question: options.question,
      history: options.history,
      page_context: options.pageContext,
    }),
    signal: options.signal,
  });

  if (!response.ok || !response.body) {
    yield {
      type: 'error',
      message:
        response.status === 401
          ? 'Your session expired. Sign in again.'
          : `The assistant is unavailable (${response.status}).`,
    };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // A chunk can split an event in half, so only whole `data:` lines are
    // parsed and the remainder waits for the next read.
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const payload = line.replace(/^data: /, '').trim();
      if (!payload) continue;
      try {
        yield JSON.parse(payload) as AssistantEvent;
      } catch {
        // A malformed frame is not worth killing the answer over.
      }
    }
  }
}

export const rateAnswer = (exchangeId: string, value: 1 | -1) =>
  axiosClient.post(`/assistant/exchanges/${exchangeId}/feedback`, { value });

export const fetchTools = () =>
  axiosClient
    .get<{ name: string; description: string }[]>('/assistant/tools')
    .then((r) => r.data);
