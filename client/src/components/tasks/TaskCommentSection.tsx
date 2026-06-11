'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '@/api/tasks';
import { Comment } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TaskCommentSectionProps {
  taskId: string;
  comments: Comment[];
  isLoading?: boolean;
}

export function TaskCommentSection({
  taskId,
  comments,
  isLoading,
}: TaskCommentSectionProps) {
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addCommentMutation = useMutation({
    mutationFn: (content: string) => tasksApi.addComment(taskId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', taskId, 'comments'] });
      setNewComment('');
      setIsSubmitting(false);
    },
    onError: () => {
      setIsSubmitting(false);
    },
  });

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    await addCommentMutation.mutateAsync(newComment);
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="text-lg font-semibold text-gray-900">Comments</h2>

      {/* Comments List */}
      {isLoading ? (
        <div className="mt-4 text-center">
          <p className="text-gray-600">Loading comments...</p>
        </div>
      ) : comments && comments.length > 0 ? (
        <div className="mt-4 space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="border-l-2 border-gray-200 pl-4">
              <div className="flex items-start justify-between">
                <p className="font-medium text-gray-900">
                  {comment.user?.fullName || 'Unknown User'}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(comment.createdAt).toLocaleDateString()}
                </p>
              </div>
              <p className="mt-1 text-gray-600">{comment.content}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 text-center">
          <p className="text-gray-600">No comments yet</p>
        </div>
      )}

      {/* Add Comment Form */}
      <form onSubmit={handleSubmitComment} className="mt-6 border-t pt-6">
        <div className="space-y-3">
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            disabled={isSubmitting}
            className="text-base"
          />
          <Button
            type="submit"
            disabled={isSubmitting || !newComment.trim()}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? 'Adding...' : 'Add Comment'}
          </Button>
        </div>
      </form>
    </div>
  );
}
