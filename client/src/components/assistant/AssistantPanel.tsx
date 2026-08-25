'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, Send, ThumbsUp, ThumbsDown } from 'lucide-react';

import { ask, rateAnswer, AssistantTurn } from '@/api/assistant';
import { AnswerText } from './AnswerText';

/**
 * The assistant, as a panel over whatever the user was already looking at.
 *
 * ```
 *   [button, bottom right, every screen]
 *          |  click
 *          v
 *   +-------------------------------+
 *   | exchanges                     |
 *   |   question (right)            |
 *   |   answer   (left, streaming)  |
 *   |   Checked: leave_balance      |  <- what it actually read
 *   |   thumbs                      |
 *   +-------------------------------+
 *   | ask box                       |
 *   +-------------------------------+
 * ```
 *
 * A panel and not a page, so the user does not lose their place, and the path
 * they are on rides along as `pageContext` so "is this on track" resolves
 * without naming the project.
 */

interface Exchange {
  question: string;
  answer: string;
  tools: string[];
  exchangeId?: string;
  error?: string;
  rated?: 1 | -1;
}

/**
 * New id per panel open. Groups the exchange log into one conversation.
 *
 * The server validates this with `@IsUUID()`, so the fallback has to produce a
 * real v4 and not just something unique. `crypto.randomUUID` is undefined
 * outside a secure context, and serving the app on a LAN address rather than
 * localhost is exactly that case, which would otherwise 400 every question.
 */
const newConversationId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export function AssistantPanel() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState(newConversationId);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  // A vendor login never sees the launcher. The API refuses them an empty tool
  // catalog anyway, but there is no reason to offer a door that opens on
  // nothing.
  const isVendorArea = pathname?.startsWith('/portal') || pathname?.startsWith('/vms');

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [exchanges, open]);

  // Leaving the page mid-answer should stop the request, not leak it.
  useEffect(() => () => abort.current?.abort(), []);

  const send = useCallback(async () => {
    const asked = question.trim();
    if (!asked || busy) return;

    setQuestion('');
    setBusy(true);
    const index = exchanges.length;
    setExchanges((prev) => [...prev, { question: asked, answer: '', tools: [] }]);

    const history: AssistantTurn[] = exchanges.flatMap((e) =>
      e.error
        ? []
        : [
            { role: 'user' as const, content: e.question },
            { role: 'assistant' as const, content: e.answer },
          ],
    );

    const controller = new AbortController();
    abort.current = controller;

    const patch = (change: Partial<Exchange>) =>
      setExchanges((prev) =>
        prev.map((e, i) => (i === index ? { ...e, ...change } : e)),
      );

    try {
      for await (const event of ask({
        conversationId,
        question: asked,
        history,
        pageContext: pathname ?? undefined,
        signal: controller.signal,
      })) {
        if (event.type === 'text') {
          setExchanges((prev) =>
            prev.map((e, i) =>
              i === index ? { ...e, answer: e.answer + event.text } : e,
            ),
          );
        } else if (event.type === 'reset') {
          // That turn was narration, not the answer. Drop it so the real
          // answer does not arrive glued to the model thinking out loud.
          patch({ answer: '' });
        } else if (event.type === 'tool') {
          setExchanges((prev) =>
            prev.map((e, i) =>
              i === index ? { ...e, tools: [...e.tools, event.name] } : e,
            ),
          );
        } else if (event.type === 'done') {
          patch({ exchangeId: event.exchangeId });
        } else if (event.type === 'error') {
          patch({ error: event.message });
        }
      }
    } catch (error) {
      // An abort is the user leaving, not a failure worth showing.
      if (!controller.signal.aborted) {
        patch({ error: 'The answer stopped partway. Ask again.' });
      }
    } finally {
      abort.current = null;
      setBusy(false);
    }
  }, [question, busy, exchanges, conversationId, pathname]);

  const rate = async (index: number, value: 1 | -1) => {
    const exchange = exchanges[index];
    if (!exchange?.exchangeId || exchange.rated) return;
    setExchanges((prev) =>
      prev.map((e, i) => (i === index ? { ...e, rated: value } : e)),
    );
    try {
      await rateAnswer(exchange.exchangeId, value);
    } catch {
      // Feedback is a nicety. A failed rating should not interrupt the user.
    }
  };

  const reset = () => {
    abort.current?.abort();
    setExchanges([]);
    setConversationId(newConversationId());
  };

  if (isVendorArea) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask the assistant"
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-700 text-white shadow-lg transition hover:bg-emerald-800"
      >
        <MessageCircle className="h-5 w-5" />
      </button>
    );
  }

  return (
    // Full width on a phone, a panel on a laptop. The MD in a meeting is the
    // case this is designed around.
    <div className="fixed inset-0 z-50 flex flex-col bg-white sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[560px] sm:w-[400px] sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-900">Assistant</p>
          <p className="text-xs text-slate-500">Ask about tasks, projects, vendors</p>
        </div>
        <div className="flex items-center gap-1">
          {exchanges.length > 0 && (
            <button
              type="button"
              onClick={reset}
              className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
            >
              New
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close the assistant"
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {exchanges.length === 0 && (
          <div className="space-y-2 pt-6 text-center text-sm text-slate-500">
            <p>Ask a question in plain English.</p>
            <p className="text-xs">
              &ldquo;What is overdue?&rdquo;
              <br />
              &ldquo;Which projects need review?&rdquo;
            </p>
          </div>
        )}

        {exchanges.map((exchange, index) => (
          <div key={index} className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white">
              {exchange.question}
            </p>

            {exchange.error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {exchange.error}
              </p>
            ) : (
              <div className="space-y-1">
                <AnswerText answer={exchange.answer} />

                {!exchange.answer && busy && index === exchanges.length - 1 && (
                  <p className="text-sm text-slate-400">Looking...</p>
                )}

                {/* What it actually read. This is how somebody learns to trust
                    the answer, and how a complaint gets debugged. */}
                {exchange.tools.length > 0 && (
                  <p className="text-[11px] text-slate-400">
                    Checked: {[...new Set(exchange.tools)].join(', ')}
                  </p>
                )}

                {exchange.exchangeId && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => rate(index, 1)}
                      aria-label="This answer was useful"
                      className={`rounded p-1 hover:bg-slate-100 ${
                        exchange.rated === 1 ? 'text-emerald-700' : 'text-slate-300'
                      }`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => rate(index, -1)}
                      aria-label="This answer was wrong"
                      className={`rounded p-1 hover:bg-slate-100 ${
                        exchange.rated === -1 ? 'text-red-600' : 'text-slate-300'
                      }`}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <form
        className="flex items-center gap-2 border-t border-slate-200 px-3 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question"
          disabled={busy}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-600 disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          aria-label="Send"
          className="rounded-lg bg-emerald-700 p-2 text-white disabled:bg-slate-300"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
