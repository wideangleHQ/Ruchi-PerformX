'use client';

import { useState } from 'react';
import { Check, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { User } from '@/api/types';
import {
  canApproveUsers,
  useApproveUser,
  usePendingUsers,
  useRejectUser,
} from '@/hooks/useApprovals';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/**
 * The registration approval queue.
 *
 * `POST /auth/register` creates the account as `pending_approval`, so nobody
 * who signs up can log in until this screen resolves them. The endpoints were
 * implemented and unreachable: `@Get('pending')` sat below `@Get(':id')` so
 * Nest read the path as a user id, and no client code called approve or reject.
 *
 * A HOD sees only their own departments, enforced server side. A pending
 * non-EMPLOYEE has no department, so those reach MD, EA and PA only.
 */
export default function ApprovalsPage() {
  const { user } = useAuth();
  const mayApprove = canApproveUsers(user?.role);

  const { data: pending = [], isLoading } = usePendingUsers(mayApprove);
  const approve = useApproveUser();
  const reject = useRejectUser();
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  if (!mayApprove) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Only the MD, a HOD, an EA or a PA can approve registrations.
      </div>
    );
  }

  const decide = (
    person: User,
    mutation: typeof approve,
    verb: 'approve' | 'reject',
  ) => {
    setError(null);
    setActing(person.id);
    mutation.mutate(person.id, {
      onError: (err: unknown) => {
        const message = (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message;
        setError(
          Array.isArray(message)
            ? message.join(', ')
            : (message ?? `Could not ${verb} ${person.fullName}.`),
        );
      },
      onSettled: () => setActing(null),
    });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900">
          <ShieldCheck size={26} className="text-green-700" />
          Registration Approvals
        </h1>
        <p className="mt-1 text-gray-600">
          Somebody who signs up cannot log in until they are approved here. Check the
          role before you approve it: it is what they asked for, not what they proved.
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-600">
          Loading the queue...
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-500">Nobody is waiting.</p>
          <p className="mt-1 text-sm text-slate-400">
            New sign-ups land here for a decision.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((person) => (
            <div
              key={person.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900">{person.fullName}</span>
                  <Badge variant="outline">{person.role}</Badge>
                  {person.department ? (
                    <Badge variant="secondary">{person.department}</Badge>
                  ) : null}
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  {person.username}
                  {person.email ? ` · ${person.email}` : ''}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50"
                  disabled={acting === person.id}
                  onClick={() => decide(person, reject, 'reject')}
                >
                  <X size={14} />
                  Reject
                </Button>
                <Button
                  className="gap-2 bg-green-600 hover:bg-green-700"
                  disabled={acting === person.id}
                  onClick={() => decide(person, approve, 'approve')}
                >
                  <Check size={14} />
                  Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
