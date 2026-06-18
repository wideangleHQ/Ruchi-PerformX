'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { selfActionsApi, SelfActionComment } from '@/api/self-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { prepareAttachmentFiles } from '@/lib/attachmentUpload';

type Draft = {
  content: string;
  attachments: File[];
};

function CommentNode({
  actionId,
  comment,
  onReply,
}: {
  actionId: string;
  comment: SelfActionComment;
  onReply: (parentId: string, draft: Draft) => Promise<void>;
}) {
  const [isReplying, setIsReplying] = useState(false);
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const submitReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await onReply(comment.id, {
        content,
        attachments: await prepareAttachmentFiles(attachments),
      });
      setContent('');
      setAttachments([]);
      setIsReplying(false);
    } catch {
      return;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-l-2 border-slate-200 pl-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-slate-900">{comment.user?.fullName || 'Unknown User'}</p>
        <p className="text-xs text-slate-500">{new Date(comment.createdAt).toLocaleDateString()}</p>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-slate-700">{comment.content}</p>
      {comment.attachments?.length ? (
        <div className="mt-3 space-y-2">
          {comment.attachments.map((file) => (
            <a
              key={file.id}
              href={file.file_url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <div className="font-medium">{file.file_name}</div>
              <div className="text-xs text-slate-500">{(file.file_size_kb ?? 0).toLocaleString()} KB</div>
            </a>
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex items-center gap-2 text-xs">
        <button type="button" className="font-medium text-green-700" onClick={() => setIsReplying((value) => !value)}>
          Reply
        </button>
      </div>
      {isReplying ? (
        <form onSubmit={submitReply} className="mt-3 space-y-3">
          <Input
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Write a reply..."
            disabled={submitting}
          />
          <Input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,image/jpeg,image/png,image/webp,application/pdf"
            onChange={(event) => setAttachments(Array.from(event.target.files ?? []))}
            disabled={submitting}
          />
          {attachments.length ? (
            <div className="space-y-1 text-xs text-slate-500">
              {attachments.map((file) => (
                <div key={`${file.name}-${file.size}`}>{file.name}</div>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting || !content.trim()} className="bg-green-600 hover:bg-green-700">
              {submitting ? 'Posting...' : 'Post Reply'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsReplying(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {comment.replies?.length ? (
        <div className="mt-4 space-y-4 border-l border-slate-100 pl-4">
          {comment.replies.map((reply) => (
            <CommentNode key={reply.id} actionId={actionId} comment={reply} onReply={onReply} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SelfActionCommentSection({ actionId }: { actionId: string }) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['self-actions', actionId, 'comments'],
    queryFn: () => selfActionsApi.getComments(actionId),
    enabled: Boolean(actionId),
  });

  const addCommentMutation = useMutation({
    mutationFn: (payload: { content: string; attachments?: File[]; parentCommentId?: string | null }) =>
      selfActionsApi.addComment(actionId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['self-actions', actionId, 'comments'] });
      setContent('');
      setAttachments([]);
      setSubmitting(false);
    },
    onError: () => {
      setSubmitting(false);
    },
  });

  const submitReply = async (parentId: string, draft: Draft) => {
    try {
      await addCommentMutation.mutateAsync({
        content: draft.content,
        attachments: draft.attachments,
        parentCommentId: parentId,
      });
    } catch {
      return;
    }
  };

  const submitComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await addCommentMutation.mutateAsync({
        content,
        attachments: await prepareAttachmentFiles(attachments),
      });
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Comments</h3>
      <div className="mt-4 space-y-4">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading comments...</p>
        ) : comments.length ? (
          comments.map((comment) => (
            <CommentNode key={comment.id} actionId={actionId} comment={comment} onReply={submitReply} />
          ))
        ) : (
          <p className="text-sm text-slate-500">No comments yet.</p>
        )}
      </div>
      <form onSubmit={submitComment} className="mt-6 space-y-3 border-t border-slate-200 pt-4">
        <Input
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Add a comment..."
          disabled={submitting}
        />
          <Input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,image/jpeg,image/png,image/webp,application/pdf"
            onChange={(event) => setAttachments(Array.from(event.target.files ?? []))}
            disabled={submitting}
          />
          {attachments.length ? (
            <div className="space-y-1 text-xs text-slate-500">
              {attachments.map((file) => (
                <div key={`${file.name}-${file.size}`}>{file.name}</div>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={submitting || !content.trim()}>
              {submitting ? 'Adding...' : 'Add Comment'}
            </Button>
          </div>
      </form>
    </div>
  );
}
