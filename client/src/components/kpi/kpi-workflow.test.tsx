import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axiosClient from '@/api/client';
import { makeDetail, makeKpi, makePsScore, paged, renderWithQuery } from '@/test/kpi-fixtures';
import { KpiClient } from './kpi-client';
import { KpiDetailSheet } from './kpi-detail-sheet';

vi.mock('@/api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() },
}));

const auth = vi.hoisted(() => ({
  user: { id: 'user-1', role: 'HOD' } as { id: string; role: string },
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('@/components/kpi/kpi-score-tab', () => ({ KpiScoreTab: () => <p>score workspace</p> }));

const get = vi.mocked(axiosClient.get);
const post = vi.mocked(axiosClient.post);
const patch = vi.mocked(axiosClient.patch);

const pending = makeKpi({
  id: 'kpi-p',
  name: 'Pending call volume',
  status: 'PENDING_APPROVAL',
  owner_user_id: 'user-2',
  created_by_id: 'user-2',
});

let listItems = [pending];
let listTotal = 1;
let detail = makeDetail();
let messages: unknown[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 'user-1', role: 'HOD' };
  listItems = [pending];
  listTotal = 1;
  detail = makeDetail({ status: 'PENDING_APPROVAL', owner_user_id: 'user-2', created_by_id: 'user-2' });
  messages = [];
  get.mockImplementation(async (url, config) => {
    if (url === '/kpis') {
      const page = (config?.params as { page?: number })?.page ?? 1;
      return { data: { items: listItems, total: listTotal, page, limit: 20 } };
    }
    if (url === '/kpis/ps-score') return { data: makePsScore() };
    if (url === '/kpis/kpi-1') return { data: detail };
    if (url === '/kpis/kpi-1/chat') return { data: messages };
    return { data: paged([]) };
  });
});

const listCalls = () => get.mock.calls.filter(([url]) => url === '/kpis');
const paramsOf = (call: unknown[]) => (call[1] as { params: Record<string, unknown> }).params;

describe('KpiClient tabs and approval', () => {
  it('asks for own KPIs first and for others when the tab changes', async () => {
    renderWithQuery(<KpiClient />);
    await screen.findByText('Pending call volume');
    expect(paramsOf(listCalls()[0])).toMatchObject({ view: 'own', page: 1 });

    await userEvent.click(screen.getByRole('button', { name: 'View others KPI' }));
    await waitFor(() => expect(listCalls().some((c) => paramsOf(c).view === 'others')).toBe(true));
  });

  it('opens the score workspace from the third tab', async () => {
    renderWithQuery(<KpiClient />);
    await userEvent.click(await screen.findByRole('button', { name: 'View score' }));
    expect(await screen.findByText('score workspace')).toBeInTheDocument();
  });

  it('shows no tabs to an employee and sends no view filter', async () => {
    auth.user = { id: 'user-3', role: 'EMPLOYEE' };
    renderWithQuery(<KpiClient />);
    await screen.findByText('Pending call volume');
    expect(screen.queryByRole('button', { name: 'View others KPI' })).not.toBeInTheDocument();
    expect(paramsOf(listCalls()[0]).view).toBeUndefined();
    expect(screen.queryByRole('button', { name: 'Quick approve' })).not.toBeInTheDocument();
  });

  it('quick approves another persons pending KPI and refetches', async () => {
    post.mockResolvedValue({ data: { ...pending, status: 'PUBLISHED' } });
    renderWithQuery(<KpiClient />);
    await userEvent.click(await screen.findByRole('button', { name: 'Quick approve' }));
    expect(post).toHaveBeenCalledWith('/kpis/kpi-p/approve');
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(1));
  });

  it('does not offer Quick approve on the authoritys own pending KPI', async () => {
    listItems = [
      makeKpi({ id: 'kpi-own', name: 'Mine', status: 'PENDING_APPROVAL', owner_user_id: 'user-1' }),
    ];
    renderWithQuery(<KpiClient />);
    await screen.findByText('Mine');
    expect(screen.queryByRole('button', { name: 'Quick approve' })).not.toBeInTheDocument();
  });

  it('shows the server refusal when approval is rejected', async () => {
    post.mockRejectedValue({ response: { data: { message: 'That is outside your department' } } });
    renderWithQuery(<KpiClient />);
    await userEvent.click(await screen.findByRole('button', { name: 'Quick approve' }));
    expect(await screen.findByText('That is outside your department')).toBeInTheDocument();
  });

  it('pages through the server list', async () => {
    listTotal = 45;
    renderWithQuery(<KpiClient />);
    await screen.findByText('Page 1 of 3');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 3');
    expect(paramsOf(listCalls().at(-1)!)).toMatchObject({ page: 2, limit: 20 });
  });
});

describe('KPI detail chat and status', () => {
  it('reads the thread of the selected KPI and posts to it', async () => {
    messages = [
      {
        id: 'm1',
        kpi_id: 'kpi-1',
        user_id: 'user-2',
        content: 'Please share evidence',
        created_at: '2026-10-02T09:00:00Z',
        user_id_user: { id: 'user-2', full_name: 'Asha Rao' },
      },
    ];
    post.mockResolvedValue({ data: {} });
    renderWithQuery(<KpiDetailSheet id="kpi-1" onClose={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: /Chat/ }));
    expect(await screen.findByText('Please share evidence')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/kpis/kpi-1/chat');

    await userEvent.type(screen.getByPlaceholderText('Write about this KPI'), 'Uploaded today');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(post).toHaveBeenCalledWith('/kpis/kpi-1/chat', { content: 'Uploaded today' });
  });

  it('keeps a deleted KPI chat read-only', async () => {
    detail = makeDetail({ status: 'DELETED' });
    renderWithQuery(<KpiDetailSheet id="kpi-1" onClose={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: /Chat/ }));
    expect(await screen.findByText(/chat is kept as history/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Write about this KPI')).not.toBeInTheDocument();
  });

  it('deletes only with a reason, through the status route', async () => {
    detail = makeDetail({ status: 'PUBLISHED' });
    patch.mockResolvedValue({ data: {} });
    renderWithQuery(<KpiDetailSheet id="kpi-1" onClose={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    const confirm = screen.getAllByRole('button', { name: 'Delete' }).at(-1)!;
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText('Why is this KPI being deleted?'), 'Duplicate');
    await userEvent.click(confirm);
    expect(patch).toHaveBeenCalledWith(
      '/kpis/kpi-1/status',
      expect.objectContaining({ status: 'DELETED' }),
    );
  });

  it('quick approves from the detail sheet for a non-owner authority', async () => {
    post.mockResolvedValue({ data: {} });
    renderWithQuery(<KpiDetailSheet id="kpi-1" onClose={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Quick approve' }));
    expect(post).toHaveBeenCalledWith('/kpis/kpi-1/approve');
  });

  it('submits a draft as PUBLISHED for an authority, PENDING_APPROVAL for an employee', async () => {
    detail = makeDetail({ status: 'DRAFT' });
    patch.mockResolvedValue({ data: {} });
    const first = renderWithQuery(<KpiDetailSheet id="kpi-1" onClose={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: /Submit|Publish/ }));
    expect(patch).toHaveBeenLastCalledWith(
      '/kpis/kpi-1/status',
      expect.objectContaining({ status: 'PUBLISHED' }),
    );
    first.unmount();

    auth.user = { id: 'user-1', role: 'EMPLOYEE' };
    renderWithQuery(<KpiDetailSheet id="kpi-1" onClose={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: /Submit|Publish/ }));
    expect(patch).toHaveBeenLastCalledWith(
      '/kpis/kpi-1/status',
      expect.objectContaining({ status: 'PENDING_APPROVAL' }),
    );
  });
});
