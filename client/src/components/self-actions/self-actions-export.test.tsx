import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axiosClient from '@/api/client';
import { Toaster } from '@/components/providers/Toaster';
import { getToasts, removeToast } from '@/hooks/useToast';
import { renderWithQuery } from '@/test/kpi-fixtures';
import { SelfActionsClient } from './self-actions-client';
import { SelfActionsFilters } from './self-actions-filters';

/**
 * The export has to carry whatever the screen is showing, so these cases are
 * about the wiring rather than the workbook: the params that leave the page,
 * the button's behaviour while the file is made, and the three answers a
 * failure can come back with. The file itself is covered server-side by
 * self-action-export.spec.ts.
 */

vi.mock('@/api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const auth = vi.hoisted(() => ({
  user: { id: 'user-1', role: 'HOD' } as { id: string; role: string },
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));

// The page reads its filters from the URL, so each test sets the query string
// it wants to be standing on when Export is pressed.
const navigation = vi.hoisted(() => ({ search: '', replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: navigation.replace, push: vi.fn() }),
  usePathname: () => '/self-actions',
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

const get = vi.mocked(axiosClient.get);

const listResponse = { data: { data: [], total: 0, page: 1, limit: 20, hasMore: false } };
const exportResponse = {
  data: new Blob(['xlsx-bytes']),
  headers: { 'content-disposition': 'attachment; filename="PerformX_Self_Actions_Export_2026-11-11.xlsx"' },
};

function rejectWith(status: number, message: string) {
  const body = new Blob([JSON.stringify({ message })], { type: 'application/json' });
  return Promise.reject({ response: { status, data: body } });
}

const exportCalls = () => get.mock.calls.filter(([url]) => url === '/self-actions/export');

/** jsdom has no object URLs and no real navigation, so both are stubbed out. */
const downloadClicks = () => vi.mocked(HTMLAnchorElement.prototype.click);

beforeEach(() => {
  vi.clearAllMocks();
  navigation.search = '';
  navigation.replace.mockClear();
  auth.user = { id: 'user-1', role: 'HOD' };

  URL.createObjectURL = vi.fn(() => 'blob:self-actions');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  get.mockImplementation(async (url: any) => {
    if (url === '/self-actions') return listResponse;
    if (url === '/self-actions/export') return exportResponse;
    return { data: [] };
  });

  getToasts().forEach((toast) => removeToast(toast.id));
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderPage() {
  return renderWithQuery(
    <>
      <Toaster />
      <SelfActionsClient />
    </>,
  );
}

describe('Self Actions export', () => {
  it('exports the filters the screen is showing and leaves pagination alone', async () => {
    navigation.search = 'createdById=u9&status=OPEN&dateFrom=2026-11-01&dateTo=2026-11-11&page=4&limit=20';

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /export to excel/i }));
    await screen.findByText('Self Actions exported successfully.');

    const call = exportCalls()[0];
    expect(call).toBeDefined();

    const params = (call[1] as { params: Record<string, unknown> }).params;
    expect(params).toMatchObject({
      createdById: 'u9',
      status: 'OPEN',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-11',
    });
    // The whole result set, not the page it is on — and the page itself is
    // never rewritten while exporting.
    expect(params.page).toBeUndefined();
    expect(params.limit).toBeUndefined();
    expect(navigation.replace).not.toHaveBeenCalled();

    expect(downloadClicks()).toHaveBeenCalledTimes(1);
    // The filename comes from the endpoint's content-disposition, not a guess.
    const anchor = downloadClicks().mock.contexts[0] as HTMLAnchorElement;
    expect(anchor?.download).toBe('PerformX_Self_Actions_Export_2026-11-11.xlsx');
  });

  it('shows Exporting… and disables the button while the file is made', async () => {
    let release: () => void = () => {};
    get.mockImplementation((url: any) => {
      if (url === '/self-actions/export') {
        return new Promise((resolve) => {
          release = () => resolve(exportResponse);
        });
      }
      if (url === '/self-actions') return Promise.resolve(listResponse);
      return Promise.resolve({ data: [] });
    });

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /export to excel/i }));

    const busy = await screen.findByRole('button', { name: /exporting/i });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');

    // Pressing it again while busy starts nothing.
    await userEvent.click(busy).catch(() => undefined);
    expect(exportCalls()).toHaveLength(1);

    release();
    await screen.findByRole('button', { name: /export to excel/i });
    expect(screen.queryByRole('button', { name: /exporting/i })).toBeNull();
    expect(busy).toBeEnabled();
  });

  it('says so, kindly, when no Self Actions match the filters', async () => {
    get.mockImplementation(async (url: any) => {
      if (url === '/self-actions') return listResponse;
      if (url === '/self-actions/export') {
        return rejectWith(404, 'No Self Actions found for the selected filters.');
      }
      return { data: [] };
    });

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /export to excel/i }));

    await screen.findByText('No Self Actions found for the selected filters.');
    // Empty is not a failure: the button stays usable for the next attempt.
    expect(await screen.findByRole('button', { name: /export to excel/i })).toBeEnabled();
  });

  it('reports a failed export without breaking the page', async () => {
    get.mockImplementation(async (url: any) => {
      if (url === '/self-actions') return listResponse;
      if (url === '/self-actions/export') {
        return rejectWith(500, 'Could not export Self Actions. Please try again.');
      }
      return { data: [] };
    });

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /export to excel/i }));

    await screen.findByText('Could not export Self Actions. Please try again.');
    expect(screen.queryByRole('button', { name: /exporting/i })).toBeNull();
  });
});

describe('Self Actions date filters', () => {
  it('hands the published date range to whatever applies the filters', async () => {
    const onApply = vi.fn();

    render(
      <SelfActionsFilters
        initialValues={{}}
        departments={[]}
        users={[]}
        showDepartmentField={false}
        showCreatorField={false}
        onApply={onApply}
        onReset={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Published from'), {
      target: { value: '2026-11-01' },
    });
    fireEvent.change(screen.getByLabelText('Published to'), {
      target: { value: '2026-11-11' },
    });
    await userEvent.click(screen.getByRole('button', { name: /apply filters/i }));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ dateFrom: '2026-11-01', dateTo: '2026-11-11' }),
    );
  });
});
