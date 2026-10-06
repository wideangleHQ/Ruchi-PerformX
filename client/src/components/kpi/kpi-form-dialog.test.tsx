import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axiosClient from '@/api/client';
import { people } from '@/test/kpi-fixtures';
import { KpiFormDialog } from './kpi-form-dialog';

vi.mock('@/api/client', () => ({ default: { get: vi.fn() } }));

const get = vi.mocked(axiosClient.get);

beforeEach(() => {
  vi.clearAllMocks();
  get.mockImplementation(async (url) => {
    if (url === '/users') return { data: people };
    if (String(url).startsWith('/kpis/allocation/')) {
      return {
        data: { user_id: 'user-1', permitted: 100, allocated: 30, remaining: 70, kpis: [] },
      };
    }
    return { data: [] };
  });
});

function open(canAssign: boolean, onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <KpiFormDialog
        open
        onClose={() => {}}
        onSubmit={onSubmit}
        isPending={false}
        error={null}
        selfId="user-1"
        canAssign={canAssign}
      />
    </QueryClientProvider>,
  );
  return onSubmit;
}

describe('KpiFormDialog', () => {
  it('lets an employee define only their own KPI and submits it for approval', async () => {
    const onSubmit = open(false);
    expect(screen.getByRole('heading', { name: 'Define your KPI' })).toBeInTheDocument();
    expect(screen.queryByText('Whose outcome is this?')).not.toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Monthly Sales Revenue'), 'Close tickets');
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Close tickets', scope: 'INDIVIDUAL' }),
    );
    expect(onSubmit.mock.calls[0][0].save_as_draft).toBeUndefined();
  });

  it('saves a draft with save_as_draft set', async () => {
    const onSubmit = open(false);
    await userEvent.type(screen.getByPlaceholderText('Monthly Sales Revenue'), 'Draft KPI');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ save_as_draft: true }));
  });

  it('shows what is already allocated and what is left, below 100 being fine', async () => {
    open(false);
    expect(
      await screen.findByText(/30% already allocated, 70% left in this period/),
    ).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(
      '/kpis/allocation/user-1',
      expect.objectContaining({ params: expect.any(Object) }),
    );
  });

  it('lets an authority assign to someone else and publishes', async () => {
    const onSubmit = open(true);
    expect(screen.getByText('Whose outcome is this?')).toBeInTheDocument();
    expect(screen.getByText('Owner *')).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('Monthly Sales Revenue'), 'Team KPI');
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });

  it('reads the allocation of the chosen owner, not the logged-in user', async () => {
    open(true);
    const owner = screen.getByText('Owner *').parentElement!.querySelector('select')!;
    await waitFor(() => expect(owner.options.length).toBeGreaterThan(1));
    await userEvent.selectOptions(owner, owner.options[1].value);
    await waitFor(() =>
      expect(get.mock.calls.some(([url]) => String(url).startsWith('/kpis/allocation/') && url !== '/kpis/allocation/user-1')).toBe(true),
    );
  });
});
