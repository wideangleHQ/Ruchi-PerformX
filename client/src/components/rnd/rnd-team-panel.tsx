'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usersApi } from '@/api/users';
import { useAddRndTeamMember, useRemoveRndTeamMember, useRndTeam } from '@/hooks/useRnd';
import { formatRndDate } from '@/components/rnd/report-history';

function errorMessage(error: unknown) {
  const response = (error as { response?: { data?: { message?: string | string[] } } })
    .response;
  const message = response?.data?.message;
  return Array.isArray(message) ? message[0] : message || 'Something went wrong';
}

/**
 * The roster screen for MD, EA, and PA. Removing someone takes away their
 * submit rights and their history view; the reports they filed stay where they
 * are, because R&D history is retained per category.
 */
export function RndTeamPanel() {
  const { data: team = [], isLoading } = useRndTeam();
  const addMutation = useAddRndTeamMember();
  const removeMutation = useRemoveRndTeamMember();
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: usersPage } = useQuery({
    queryKey: ['rnd', 'candidates'],
    queryFn: () => usersApi.getUsers({ page: 1, limit: 200 }),
  });

  const candidates = useMemo(() => {
    const onTeam = new Set(team.map((member) => member.user_id));
    return (usersPage?.data ?? [])
      .filter((user) => !onTeam.has(user.id))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [usersPage, team]);

  const add = async () => {
    if (!selected) return;
    setError(null);
    try {
      await addMutation.mutateAsync(selected);
      setSelected('');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async (userId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from the R&D team?`)) return;
    setError(null);
    try {
      await removeMutation.mutateAsync(userId);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Invite to the R&D team</h2>
        <p className="mt-1 text-sm text-slate-500">
          Membership is company wide, not per project. Only members can submit
          research reports.
        </p>
        {error ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none sm:max-w-sm"
          >
            <option value="">Select a person...</option>
            {candidates.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName} ({user.role})
              </option>
            ))}
          </select>
          <Button
            type="button"
            className="gap-2 bg-green-600 hover:bg-green-700"
            disabled={!selected || addMutation.isPending}
            onClick={add}
          >
            <UserPlus size={16} />
            {addMutation.isPending ? 'Adding...' : 'Add Member'}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold text-slate-900">
            Team members{' '}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {team.length}
            </span>
          </h2>
        </header>

        {isLoading ? (
          <p className="px-5 py-6 text-sm text-slate-500">Loading roster...</p>
        ) : team.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            Nobody on the R&D team yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {team.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-3 px-5 py-4"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {member.user_id_user?.full_name ?? 'Unknown user'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {member.user_id_user?.role ?? '-'} · added{' '}
                    {formatRndDate(member.added_at)} by{' '}
                    {member.added_by_id_user?.full_name ?? 'unknown'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={removeMutation.isPending}
                  onClick={() =>
                    remove(
                      member.user_id,
                      member.user_id_user?.full_name ?? 'this member',
                    )
                  }
                >
                  <Trash2 size={14} className="mr-2" />
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
