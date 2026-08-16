'use client';

import { useState } from 'react';
import type { ProjectMessage } from '@/api/projects';
import { usePostProjectMessage } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { fmtDateTime, userName } from '@/components/projects/ProjectMeta';

/** Conversation. The audit trail lives in the activity log and stays separate. */
export function MessagesPanel({
  projectId,
  messages,
  isLoading,
  canParticipate,
}: {
  projectId: string;
  messages: ProjectMessage[];
  isLoading?: boolean;
  canParticipate: boolean;
}) {
  const [content, setContent] = useState('');
  const postMessage = usePostProjectMessage(projectId);

  const send = async () => {
    const value = content.trim();
    if (!value) return;
    await postMessage.mutateAsync(value);
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
            placeholder="Write a message to the project team"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          />
          <div className="mt-3 flex justify-end">
            <Button
              onClick={send}
              disabled={!content.trim() || postMessage.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {postMessage.isPending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Observers can read the thread but cannot post.</p>
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
                <span className="text-sm font-medium text-gray-900">{userName(message.user_id_user)}</span>
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
