import { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { Kpi, KpiDetail, PsScore } from '@/api/kpi';

export function makeKpi(overrides: Partial<Kpi> = {}): Kpi {
  return {
    id: 'kpi-1',
    scope: 'INDIVIDUAL',
    owner_user_id: 'user-1',
    department_id: null,
    project_id: null,
    name: 'Monthly Sales Revenue',
    description: 'Revenue booked in the month',
    mode: 'QUANTITATIVE',
    unit_label: 'Rupees',
    unit_symbol: '₹',
    target_value: '100000.0000',
    baseline_value: null,
    direction: 'HIGHER_IS_BETTER',
    scoring_method: 'DIRECT',
    scoring_config: null,
    weight: '40.00',
    period: 'MONTHLY',
    period_start: '2026-10-01T00:00:00.000Z',
    period_end: '2026-10-31T00:00:00.000Z',
    evidence_required: false,
    review_required: false,
    status: 'DRAFT',
    legacy_status: null,
    created_by_id: 'user-1',
    approved_by_id: null,
    approved_at: null,
    cancelled_at: null,
    cancel_reason: null,
    locked_at: null,
    created_at: '2026-10-01T00:00:00.000Z',
    owner_user_id_user: null,
    created_by_id_user: null,
    ...overrides,
  };
}

export function makeDetail(overrides: Partial<KpiDetail> = {}): KpiDetail {
  return {
    ...makeKpi(),
    actual_value: null,
    achievement: null,
    score: null,
    milestones: [],
    contributions: [],
    updates: [],
    revisions: [],
    ...overrides,
  } as KpiDetail;
}

export function paged<T>(data: T[], page = 1, limit = 20, total = data.length) {
  return { data, total, page, limit, hasMore: page * limit < total };
}

/** A client that never retries, so a rejected request settles on the first try. */
export function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { client, ...result };
}

export function makePsScore(overrides: Partial<PsScore> = {}): PsScore {
  return {
    user_id: 'user-2',
    month: 10,
    year: 2026,
    ps_score: 82.5,
    counted_weight: 100,
    declared_weight: 100,
    kpis: [
      {
        id: 'kpi-9',
        name: 'Quality audit pass rate',
        scope: 'INDIVIDUAL',
        mode: 'QUANTITATIVE',
        status: 'PUBLISHED',
        unit_label: 'Percent',
        unit_symbol: '%',
        target_value: 95,
        weight: 100,
        effective_weight: 100,
        contribution_share: 100,
        counted: true,
        contribution: 82.5,
        actual_value: 90,
        rating: null,
        achievement: 94.7,
        score: 82.5,
      },
    ],
    ...overrides,
  } as PsScore;
}

export const people = [
  { id: 'user-1', fullName: 'Hari HOD', username: 'hari', role: 'HOD' },
  { id: 'user-2', fullName: 'Asha Employee', username: 'asha', role: 'EMPLOYEE' },
  { id: 'user-3', fullName: 'Ravi Employee', username: 'ravi', role: 'EMPLOYEE' },
];
