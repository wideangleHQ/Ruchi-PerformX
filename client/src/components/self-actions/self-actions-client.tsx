'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus, RefreshCcw, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelfActionsFilters } from '@/components/self-actions/self-actions-filters';
import { SelfActionsStats } from '@/components/self-actions/self-actions-stats';
import { SelfActionsTable } from '@/components/self-actions/self-actions-table';
import { CreateSelfActionDialog } from '@/components/self-actions/create-self-action-dialog';
import { EditSelfActionDialog } from '@/components/self-actions/edit-self-action-dialog';
import { SelfActionDetailsSheet } from '@/components/self-actions/self-action-details-sheet';
import { useSelfActions } from '@/hooks/use-self-actions';
import { useCreateSelfAction } from '@/hooks/use-create-self-action';
import { useUpdateSelfAction } from '@/hooks/use-update-self-action';
import {
  selfActionsApi,
  SelfAction,
  SelfActionFilters,
  SelfActionPriority,
  SelfActionStatus,
} from '@/api/self-actions';
import { usersApi } from '@/api/users';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';

const DEFAULT_LIMIT = 20;

type SearchParamsLike = {
  get: (name: string) => string | null;
  toString: () => string;
};

function parseFilters(searchParams: SearchParamsLike): SelfActionFilters {
  return {
    search: searchParams.get('search') || undefined,
    status: (searchParams.get('status') as SelfActionStatus) || undefined,
    priority: (searchParams.get('priority') as SelfActionFilters['priority']) || undefined,
    departmentId: searchParams.get('departmentId') || undefined,
    createdById: searchParams.get('createdById') || undefined,
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
    page: Number(searchParams.get('page') || 1),
    limit: Number(searchParams.get('limit') || DEFAULT_LIMIT),
  };
}

function errorMessage(error: unknown) {
  return (error as any)?.response?.data?.message || 'Something went wrong';
}

function setQueryParams(
  pathname: string,
  searchParams: SearchParamsLike,
  router: ReturnType<typeof useRouter>,
  next: Partial<SelfActionFilters>,
  resetPage = true,
) {
  const params = new URLSearchParams(searchParams.toString());
  const normalized = { ...parseFilters(params), ...next };

  const entries: Array<[keyof SelfActionFilters, string | number | undefined]> = [
    ['search', normalized.search],
    ['status', normalized.status],
    ['priority', normalized.priority],
    ['departmentId', normalized.departmentId],
    ['createdById', normalized.createdById],
    ['dateFrom', normalized.dateFrom],
    ['dateTo', normalized.dateTo],
  ];

  entries.forEach(([key, value]) => {
    if (value) params.set(String(key), String(value));
    else params.delete(String(key));
  });

  params.set('limit', String(normalized.limit || DEFAULT_LIMIT));
  params.set('page', String(resetPage ? 1 : normalized.page || 1));
  router.replace(`${pathname}?${params.toString()}`);
}

export function SelfActionsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const activeTab: 'all' | 'mine' = searchParams.get('tab') === 'mine' ? 'mine' : 'all';

  const { user } = useAuth();
  const canUseDepartmentLookup = !!user && (user.role === 'MD' || user.role === 'HOD' || user.role === 'EA' || user.role === 'PA' || user.role === 'PURCHASE_HEAD' || user.role === 'DEPARTMENT_CONTROLLER' || user.role === 'ADMIN');
  const canUseCreatorLookup = !!user && user.role === 'ADMIN' && activeTab === 'all';

  const queryFilters = useMemo<SelfActionFilters>(
    () =>
      activeTab === 'mine'
        ? { ...filters, mine: true, createdById: undefined }
        : filters,
    [filters, activeTab],
  );

  const { data, isLoading, isError, refetch } = useSelfActions(queryFilters);
  const createMutation = useCreateSelfAction();
  const updateMutation = useUpdateSelfAction();

  const { data: departments = [] } = useQuery({
    queryKey: ['self-actions', 'departments'],
    queryFn: async () => {
      try {
        return await usersApi.getDepartments();
      } catch {
        return [];
      }
    },
    enabled: canUseDepartmentLookup,
  });

  const { data: usersPage } = useQuery({
    queryKey: ['self-actions', 'creators'],
    queryFn: async () => {
      try {
        return await usersApi.getUsers({ page: 1, limit: 200 });
      } catch {
        return { data: [], total: 0 };
      }
    },
    enabled: canUseCreatorLookup,
  });

  const users = usersPage?.data ?? [];
  const actions = data?.data ?? [];
  const total = data?.total ?? 0;
  const page = data?.page ?? filters.page ?? 1;
  const limit = data?.limit ?? filters.limit ?? DEFAULT_LIMIT;
  const totalPages = Math.max(Math.ceil(total / limit), 1);

  const [createOpen, setCreateOpen] = useState(false);
  const [editAction, setEditAction] = useState<SelfAction | null>(null);
  const [detailsAction, setDetailsAction] = useState<SelfAction | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SelfActionStatus }) =>
      selfActionsApi.changeSelfActionStatus(id, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['self-actions'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => selfActionsApi.deleteSelfAction(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['self-actions'] });
    },
  });

  const applyFilters = (next: SelfActionFilters) => {
    setQueryParams(pathname, new URLSearchParams(searchParams.toString()), router, next, true);
  };

  const resetFilters = () => {
    const tabParam = activeTab === 'mine' ? '&tab=mine' : '';
    router.replace(`${pathname}?page=1&limit=${DEFAULT_LIMIT}${tabParam}`);
  };

  const changeTab = (tab: 'all' | 'mine') => {
    if (tab === activeTab) return;
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'mine') params.set('tab', 'mine');
    else params.delete('tab');
    params.set('page', '1');
    params.set('limit', String(limit));
    router.replace(`${pathname}?${params.toString()}`);
  };

  const changePage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(nextPage));
    params.set('limit', String(limit));
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleCreate = async (values: {
    title: string;
    description: string;
    priority: SelfActionPriority;
    attachments: File[];
    department_ids?: string[];
  }) => {
    try {
      setDialogError(null);
      await createMutation.mutateAsync(values);
      setCreateOpen(false);
    } catch (error) {
      setDialogError(errorMessage(error));
    }
  };

  const handleEdit = async (values: {
    title: string;
    description: string;
    priority: SelfActionPriority;
  }) => {
    if (!editAction) return;
    try {
      setDialogError(null);
      await updateMutation.mutateAsync({ id: editAction.id, data: values });
      setEditAction(null);
    } catch (error) {
      setDialogError(errorMessage(error));
    }
  };

  const handleStatusChange = async (action: SelfAction, status: SelfActionStatus) => {
    try {
      await statusMutation.mutateAsync({ id: action.id, status });
    } catch {
      await queryClient.invalidateQueries({ queryKey: ['self-actions'] });
    }
  };

  const handleDelete = async (action: SelfAction) => {
    const confirmed = window.confirm(`Delete "${action.title}"?`);
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(action.id);
    } catch {
      await queryClient.invalidateQueries({ queryKey: ['self-actions'] });
    }
  };

  const currentDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  const stats = {
    total,
    open: actions.filter((item) => item.status === 'OPEN').length,
    ongoing: actions.filter((item) => item.status === 'ONGOING').length,
    completed: actions.filter((item) => item.status === 'COMPLETED').length,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
            <Clock3 size={14} />
            Self Actions
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Self Actions</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track, manage and monitor department activities.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <Clock3 size={16} className="text-green-600" />
            <span>{currentDate}</span>
          </div>
          <Button
            type="button"
            className="gap-2 bg-green-600 hover:bg-green-700"
            onClick={() => {
              setDialogError(null);
              setCreateOpen(true);
            }}
          >
            <Plus size={16} />
            Create Action
          </Button>
        </div>
      </div>

      <div className="flex w-fit items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="tablist" aria-label="Self actions view">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'all'}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'all'
              ? 'bg-green-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          onClick={() => changeTab('all')}
        >
          All Self Actions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'mine'}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'mine'
              ? 'bg-green-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          onClick={() => changeTab('mine')}
        >
          My Self Actions
        </button>
      </div>

      <SelfActionsStats {...stats} />

      <SelfActionsFilters
        initialValues={filters}
        departments={departments}
        users={users}
        showDepartmentField={canUseDepartmentLookup}
        showCreatorField={canUseCreatorLookup}
        onApply={applyFilters}
        onReset={resetFilters}
      />

      {isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <div className="font-semibold">Failed to load self actions.</div>
          <Button variant="outline" className="mt-3" onClick={() => refetch()}>
            <RefreshCcw size={14} className="mr-2" />
            Retry
          </Button>
        </div>
      ) : (
        <SelfActionsTable
          actions={actions}
          isLoading={isLoading}
          onView={(action) => {
            setDialogError(null);
            setDetailsAction(action);
          }}
          onEdit={(action) => {
            setDialogError(null);
            setEditAction(action);
          }}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
        />
      )}

      <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm sm:flex-row">
        <p>
          Showing {actions.length} of {total} actions
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => changePage(page - 1)}>
            Prev
          </Button>
          <span className="min-w-20 text-center">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>
            Next
          </Button>
        </div>
      </div>

      <CreateSelfActionDialog
        open={createOpen}
        onClose={() => {
          setDialogError(null);
          setCreateOpen(false);
        }}
        onSubmit={handleCreate}
        isPending={createMutation.isPending}
        error={dialogError}
      />

      <EditSelfActionDialog
        open={Boolean(editAction)}
        action={editAction}
        onClose={() => {
          setDialogError(null);
          setEditAction(null);
        }}
        onSubmit={handleEdit}
        isPending={updateMutation.isPending}
        error={dialogError}
      />

      <SelfActionDetailsSheet
        open={Boolean(detailsAction)}
        action={detailsAction}
        onClose={() => setDetailsAction(null)}
      />
    </div>
  );
}
