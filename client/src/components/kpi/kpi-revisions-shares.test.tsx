import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axiosClient from '@/api/client';
import { KpiScope, KpiStatus } from '@/api/kpi';
import { makeDetail, makeKpi, people, renderWithQuery } from '@/test/kpi-fixtures';
import { KpiDetailSheet } from './kpi-detail-sheet';
import { buildRevisionPayload } from './kpi-revision-dialog';
import { buildSharesPayload } from './kpi-shares-dialog';

vi.mock('@/api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() },
}));

const auth = vi.hoisted(() => ({ user: { id: 'user-1', role: 'HOD' } as { id: string; role: string } | null }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));

const get = vi.mocked(axiosClient.get);
const post = vi.mocked(axiosClient.post);
const put = vi.mocked(axiosClient.put);

let status: KpiStatus;
let scope: KpiScope;

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 'user-1', role: 'HOD' };
  status = 'PUBLISHED';
  scope = 'INDIVIDUAL';
  get.mockImplementation(async (url) => {
    if (url === '/kpis/kpi-1') return { data: makeDetail({ status, scope }) };
    if (url === '/users') return { data: people };
    return { data: [] };
  });
});

const fetches = () => get.mock.calls.filter(([url]) => url === '/kpis/kpi-1').length;

describe('buildRevisionPayload', () => {
  const kpi = makeKpi({ status: 'PUBLISHED' });
  const base = { new_target: '', new_weight: '', effective_from: '2026-11-01', reason: 'Market shifted' };

  it('sends only the value that changed', () => {
    expect(buildRevisionPayload(kpi, { ...base, new_target: '120000' }).payload).toEqual({
      new_target: 120000,
      effective_from: '2026-11-01',
      reason: 'Market shifted',
    });
    expect(buildRevisionPayload(kpi, { ...base, new_weight: '30' }).payload).toEqual({
      new_weight: 30,
      effective_from: '2026-11-01',
      reason: 'Market shifted',
    });
  });

  it('refuses a revision that changes neither, or retypes the current value', () => {
    expect(buildRevisionPayload(kpi, base).errors).toContain('Change the target or the weight.');
    expect(buildRevisionPayload(kpi, { ...base, new_weight: '40' }).errors).toContain(
      'Change the target or the weight.',
    );
  });

  it('needs a reason and a date, and a weight inside 0.01 to 100', () => {
    const result = buildRevisionPayload(kpi, { ...base, new_weight: '250', reason: ' ', effective_from: '' });
    expect(result.payload).toBeNull();
    expect(result.errors).toEqual([
      'The new weight must be between 0.01 and 100.',
      'Say when the change takes effect.',
      'A revision needs a reason.',
    ]);
  });
});

describe('buildSharesPayload', () => {
  it('sends the whole allocation as numbers and ignores blank rows', () => {
    const { payload, total } = buildSharesPayload([
      { user_id: 'user-2', share: '60' },
      { user_id: 'user-3', share: '25.5' },
      { user_id: '', share: '' },
    ]);
    expect(payload).toEqual({
      contributions: [
        { user_id: 'user-2', share: 60 },
        { user_id: 'user-3', share: 25.5 },
      ],
    });
    expect(total).toBe(85.5);
  });

  it('allows an empty list, which clears the allocation', () => {
    expect(buildSharesPayload([{ user_id: '', share: '' }]).payload).toEqual({ contributions: [] });
  });

  it('refuses more than 100 in total, a repeated person, and a half-filled row', () => {
    expect(buildSharesPayload([{ user_id: 'a', share: '70' }, { user_id: 'b', share: '40' }]).errors[0]).toMatch(
      /more than the outcome/,
    );
    expect(buildSharesPayload([{ user_id: 'a', share: '10' }, { user_id: 'a', share: '20' }]).errors).toContain(
      'A person can only appear once.',
    );
    expect(buildSharesPayload([{ user_id: '', share: '20' }]).errors).toContain('Choose a person for every share.');
    expect(buildSharesPayload([{ user_id: 'a', share: '' }]).errors).toContain(
      'Each share must be between 0 and 100.',
    );
  });
});

describe('KpiDetailSheet revise', () => {
  it.each(['HOD', 'MD', 'EA', 'PA', 'DEPARTMENT_CONTROLLER'])(
    'offers Revise on a published KPI to %s',
    async (role) => {
      auth.user = { id: 'user-9', role };
      renderWithQuery(<KpiDetailSheet id="kpi-1" onClose={vi.fn()} />);
      expect(await screen.findByRole('button', { name: /Revise/ })).toBeInTheDocument();
    },
  );

  it.each(['DRAFT', 'PENDING_APPROVAL', 'DELETED'] as KpiStatus[])('does not offer Revise on a %s KPI', async (next) => {
    status = next;
    renderWithQuery(<KpiDetailSheet id="kpi-1" onClose={vi.fn()} />);
    await screen.findByText('Monthly Sales Revenue');
    expect(screen.queryByRole('button', { name: /Revise/ })).not.toBeInTheDocument();
  });

  it('does not offer Revise to an employee', async () => {
    auth.user = { id: 'emp-1', role: 'EMPLOYEE' };
    renderWithQuery(<KpiDetailSheet id="kpi-1" onClose={vi.fn()} />);
    await screen.findByText('Monthly Sales Revenue');
    expect(screen.queryByRole('button', { name: /Revise/ })).not.toBeInTheDocument();
  });

  it('POSTs /kpis/:id/revisions, closes and refetches', async () => {
    post.mockResolvedValue({ data: {} });
    renderWithQuery(<KpiDetailSheet id="kpi-1" onClose={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: /Revise/ }));
    await userEvent.type(screen.getByLabelText(/New target/), '120000');
    await userEvent.clear(screen.getByLabelText(/Effective from/));
    await userEvent.type(screen.getByLabelText(/Effective from/), '2026-11-01');
    await userEvent.type(screen.getByLabelText(/Reason/), 'Market shifted');

    const before = fetches();
    await userEvent.click(screen.getByRole('button', { name: 'Record revision' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/kpis/kpi-1/revisions', {
      new_target: 120000,
      effective_from: '2026-11-01',
      reason: 'Market shifted',
    });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Revise KPI' })).not.toBeInTheDocument());
    await waitFor(() => expect(fetches()).toBeGreaterThan(before));
  });

  it('does not send an invalid revision', async () => {
    renderWithQuery(<KpiDetailSheet id="kpi-1" onClose={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: /Revise/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Record revision' }));

    expect(screen.getByText('Change the target or the weight.')).toBeInTheDocument();
    expect(screen.getByText('A revision needs a reason.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('keeps the dialog open and shows the server\'s refusal', async () => {
    post.mockRejectedValue({ response: { data: { message: 'A LOCKED KPI cannot be revised' } } });
    renderWithQuery(<KpiDetailSheet id="kpi-1" onClose={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: /Revise/ }));
    await userEvent.type(screen.getByLabelText(/New weight/), '30');
    await userEvent.type(screen.getByLabelText(/Reason/), 'Rebalanced');
    await userEvent.click(screen.getByRole('button', { name: 'Record revision' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('A LOCKED KPI cannot be revised');
    expect(screen.getByRole('dialog', { name: 'Revise KPI' })).toBeInTheDocument();
  });
});

describe('KpiDetailSheet allocation', () => {
  it.each(['DEPARTMENT', 'PROJECT'] as KpiScope[])('offers Edit allocation on a %s KPI', async (next) => {
    scope = next;
    renderWithQuery(<KpiDetailSheet id="kpi-1" onClose={vi.fn()} />);
    expect(await screen.findByRole('button', { name: /Edit allocation/ })).toBeInTheDocument();
  });

  it('does not offer it on an individual KPI, which is owned outright', async () => {
    renderWithQuery(<KpiDetailSheet id="kpi-1" onClose={vi.fn()} />);
    await screen.findByText('Monthly Sales Revenue');
    expect(screen.queryByRole('button', { name: /Edit allocation/ })).not.toBeInTheDocument();
  });

  it('does not offer it to an employee', async () => {
    scope = 'DEPARTMENT';
    auth.user = { id: 'emp-1', role: 'EMPLOYEE' };
    renderWithQuery(<KpiDetailSheet id="kpi-1" onClose={vi.fn()} />);
    await screen.findByText('Monthly Sales Revenue');
    expect(screen.queryByRole('button', { name: /Edit allocation/ })).not.toBeInTheDocument();
  });

  it('PUTs the whole allocation to /kpis/:id/contributions and refetches', async () => {
    scope = 'DEPARTMENT';
    put.mockResolvedValue({ data: [] });
    renderWithQuery(<KpiDetailSheet id="kpi-1" onClose={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: /Edit allocation/ }));
    const dialog = screen.getByRole('dialog', { name: 'Edit shares' });
    await within(dialog).findByRole('option', { name: 'Asha Employee' });
    await userEvent.selectOptions(within(dialog).getByLabelText('Person 1'), 'user-2');
    await userEvent.type(within(dialog).getByLabelText('Share 1'), '60');
    await userEvent.click(within(dialog).getByRole('button', { name: /Add person/ }));
    await userEvent.selectOptions(within(dialog).getByLabelText('Person 2'), 'user-3');
    await userEvent.type(within(dialog).getByLabelText('Share 2'), '25');
    expect(within(dialog).getByText('Allocated: 85%')).toBeInTheDocument();

    const before = fetches();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save allocation' }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith('/kpis/kpi-1/contributions', {
      contributions: [
        { user_id: 'user-2', share: 60 },
        { user_id: 'user-3', share: 25 },
      ],
    });
    await waitFor(() => expect(fetches()).toBeGreaterThan(before));
  });

  it('shows the server\'s message when the allocation is refused', async () => {
    scope = 'PROJECT';
    put.mockRejectedValue({ response: { data: { message: 'Contribution shares total 120%, which is more than the outcome' } } });
    renderWithQuery(<KpiDetailSheet id="kpi-1" onClose={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: /Edit allocation/ }));
    const dialog = screen.getByRole('dialog', { name: 'Edit shares' });
    await within(dialog).findByRole('option', { name: 'Asha Employee' });
    await userEvent.selectOptions(within(dialog).getByLabelText('Person 1'), 'user-2');
    await userEvent.type(within(dialog).getByLabelText('Share 1'), '50');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save allocation' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('more than the outcome');
  });

  it('blocks a total over 100 before it reaches the server', async () => {
    scope = 'DEPARTMENT';
    renderWithQuery(<KpiDetailSheet id="kpi-1" onClose={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: /Edit allocation/ }));
    const dialog = screen.getByRole('dialog', { name: 'Edit shares' });
    await within(dialog).findByRole('option', { name: 'Asha Employee' });
    await userEvent.selectOptions(within(dialog).getByLabelText('Person 1'), 'user-2');
    await userEvent.type(within(dialog).getByLabelText('Share 1'), '150');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save allocation' }));

    expect(within(dialog).getByText('Each share must be between 0 and 100.')).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });
});
