'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { fmtDateTime } from '@/components/projects/ProjectMeta';

/** The fields the thread reads. A project message and a KPI message both have
 * them, which is why the KPI chat reuses this panel rather than copying it. */
export interface ThreadMessage {
  id: string;
  content: string;
  created_at: string;
  user_id_user?: { full_name?: string | null } | null;
}

/**
 * Conversation. The audit trail lives in the activity log and stays separate.
 *
 * The thread does not know what it belongs to: the caller hands it the
 * messages and a `onSend` that posts to the right place.
 */
export function MessagesPanel({
  messages,
  isLoading,
  canParticipate,
  onSend,
  isSending,
  placeholder = 'Write a message to the project team',
  readOnlyNote = 'Observers can read the thread but cannot post.',
}: {
  messages: ThreadMessage[];
  isLoading?: boolean;
  canParticipate: boolean;
  onSend: (content: string) => Promise<unknown>;
  isSending?: boolean;
  placeholder?: string;
  readOnlyNote?: string;
}) {
  const [content, setContent] = useState('');

  const send = async () => {
    const value = content.trim();
    if (!value) return;
    await onSend(value);
    setContent('');
  };

  if (isLoading) {
    return <div className="py-12 text-center text-gray-500">Loading messages...</div>;
  }

  return (
    <div className="space-y-4">
      {canParticipate ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={3}
            placeholder={placeholder}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          />
          <div className="mt-3 flex justify-end">
            <Button
              onClick={send}
              disabled={!content.trim() || isSending}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">{readOnlyNote}</p>
      )}

      {messages.length === 0 ? (
        <div className="rounded-lg bg-gray-50 py-16 text-center">
          <p className="text-gray-500">No messages yet</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {messages.map((message) => (
            <div key={message.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-900">{message.user_id_user?.full_name ?? 'Unknown'}</span>
                <span className="text-xs text-gray-500">{fmtDateTime(message.created_at)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{message.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
