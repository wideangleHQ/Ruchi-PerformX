import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axiosClient from '@/api/client';
import { makePsScore, people, renderWithQuery } from '@/test/kpi-fixtures';
import { KpiScoreTab } from './kpi-score-tab';

vi.mock('@/api/client', () => ({ default: { get: vi.fn() } }));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', role: 'HOD' } }),
}));

const get = vi.mocked(axiosClient.get);

const row = {
  id: 'score-1',
  user: { id: 'user-2', full_name: 'Asha Rao', username: 'asha', email: 'asha@x.com', role: 'EMPLOYEE' },
  department: { id: 'dep-1', name: 'Sales' },
  month: 10,
  year: 2026,
  final_score: 82.5,
  self_productivity_score: 80,
  assigned_task_score: 85,
  self_actions_completed: 4,
  self_actions_total: 5,
  assigned_tasks_completed: 3,
  assigned_tasks_total: 3,
  overdue_tasks_count: 0,
  is_finalized: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  get.mockImplementation(async (url) => {
    if (url === '/kpis/scores') {
      return { data: { items: [row], total: 1, page: 1, limit: 20, departments: [{ id: 'dep-1', name: 'Sales' }] } };
    }
    if (url === '/kpis/ps-score/user-2') return { data: makePsScore() };
    if (url === '/users') return { data: people };
    return { data: [] };
  });
});

describe('KpiScoreTab', () => {
  it('lists stored scores and searches by name', async () => {
    renderWithQuery(<KpiScoreTab />);
    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    for (const text of ['asha@x.com', 'Sales', 'Oct 2026', '82.5', '80', '85', '4 / 5', '3 / 3', 'Yes']) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }

    await userEvent.type(screen.getByPlaceholderText(/name, username/i), 'asha');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/kpis/scores', {
        params: expect.objectContaining({ q: 'asha' }),
      }),
    );
  });

  it('opens the KPI breakdown for a person and month from the ps-score route', async () => {
    renderWithQuery(<KpiScoreTab />);
    await userEvent.click(await screen.findByRole('button', { name: 'KPIs' }));

    expect(await screen.findByText('Quality audit pass rate')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/kpis/ps-score/user-2', { params: { month: 10, year: 2026 } });

    await userEvent.click(screen.getByRole('button', { name: 'Hide KPIs' }));
    expect(screen.queryByText('Quality audit pass rate')).not.toBeInTheDocument();
  });

  it('shows an error when the breakdown fails', async () => {
    get.mockImplementation(async (url) => {
      if (url === '/kpis/scores') {
        return { data: { items: [row], total: 1, page: 1, limit: 20, departments: [] } };
      }
      if (url === '/kpis/ps-score/user-2') throw new Error('403');
      return { data: [] };
    });
    renderWithQuery(<KpiScoreTab />);
    await userEvent.click(await screen.findByRole('button', { name: 'KPIs' }));
    expect(await screen.findByText(/breakdown could not be loaded/i)).toBeInTheDocument();
  });
});
